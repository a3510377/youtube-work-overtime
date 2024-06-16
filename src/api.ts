import axios from "axios";
import EventEmitter from "events";
import { parseChatData } from "youtube-chat/dist/parser";
import { fetchLivePage } from "youtube-chat/dist/requests";
import type {
  FetchOptions,
  GetLiveChatResponse,
} from "youtube-chat/dist/types/yt-response";
import type { ChatItem } from "youtube-chat/dist/types/data";

import { AREA, MembershipLevelRegex, EXCHANGERATES_KEY } from "./config";
import { AreaToCurrency } from "./utils/data";
import { day } from "./utils";

export const getChat = async (options: FetchOptions) => {
  const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${options.apiKey}`;
  await axios.post(url, {
    context: {
      client: {
        clientVersion: options.clientVersion,
        clientName: "WEB",
      },
    },
    continuation: options.continuation,
  });
};

export class LiveChat extends EventEmitter {
  public liveId?: string;
  protected observer?: NodeJS.Timer;
  protected options?: FetchOptions;
  protected oneData?: boolean;
  protected exchange?: Record<string, number>;

  public constructor(url: string, protected readonly interval = 1000) {
    super();

    const [, channelId, liveId] =
      url.match(
        /^https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/([^/]+)|watch\?v=([^/]+))$/
      ) || [];

    this.start(channelId ? { channelId } : { liveId });

    const updateExchangeRates = async () => {
      const {
        data: { conversion_rates },
      } = await axios.get(
        `https://v6.exchangerate-api.com/v6/${EXCHANGERATES_KEY}/latest/${AREA}`
      );
      this.exchange = <typeof this.exchange>conversion_rates;
    };
    setInterval(updateExchangeRates.bind(this), day);
    updateExchangeRates();
  }

  public async start(
    id: { channelId: string } | { liveId: string }
  ): Promise<boolean> {
    if (this.observer) return false;

    // TODO
    const options = await fetchLivePage(id);
    this.liveId = options.liveId;
    this.options = options;

    this.observer = setInterval(this.execute.bind(this), this.interval);

    this.emit("start", this.liveId);
    return true;
  }

  public stop(reason?: string) {
    if (!this.observer) return;

    clearInterval(this.observer);
    this.observer = void 0;
    this.emit("end", reason);
  }

  public async execute() {
    if (!this.options) {
      const message = "Not found options";
      this.stop(message);
      throw new Error(message);
    }

    const data = await this.getChat(this.options);

    this.options.continuation = data.continuation;

    const {
      chat: [chatItems, continuation],
    } = data;

    if (chatItems.length > 0 && !this.oneData) {
      this.oneData = true;
      return;
    }

    chatItems.forEach((chatItem) => this.emit("chat", chatItem));

    data.MembershipType && this.emit("newMembership", data);
    data.amountValue && this.emit("newPaidMessage", data);

    this.options.continuation = continuation;
  }

  protected async getChat(options: FetchOptions) {
    const url = `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${options.apiKey}`;

    return parseChat(
      await axios
        .post(url, {
          context: {
            client: { clientVersion: options.clientVersion, clientName: "WEB" },
          },
          continuation: options.continuation,
        })
        .then(({ data }): GetLiveChatResponse => data),
      this.exchange || {}
    );
  }
}

export interface LiveChatEvents {
  start: [liveId: string | undefined];
  end: [reason: string | undefined];

  chat: [chat: ChatItem];
  newMembership: [chat: parseChatType];
  newPaidMessage: [chat: parseChatType];
}

export interface LiveChat {
  on<T extends keyof LiveChatEvents>(
    event: T,
    listener: (...args: LiveChatEvents[T]) => void
  ): this;

  once<T extends keyof LiveChatEvents>(
    event: T,
    listener: (...args: LiveChatEvents[T]) => void
  ): this;

  emit<T extends keyof LiveChatEvents>(
    event: T,
    ...args: LiveChatEvents[T]
  ): boolean;
}

export const parseChat = async (
  data: GetLiveChatResponse,
  exchange: Record<string, number>
) => {
  const {
    continuationContents: {
      liveChatContinuation: {
        actions,
        continuations: [continuationData],
      },
    },
  } = data;
  const {
    data: { rates },
  } = await axios.get(`https://api.exchangerate.host/latest?base=${AREA}`);
  exchange = <typeof exchange>rates;

  /* continuation */
  const continuation =
    continuationData.invalidationContinuationData?.continuation ??
    continuationData.timedContinuationData?.continuation ??
    "";

  const actionChatItemAction = actions?.[0].addChatItemAction?.item;
  /* MembershipMessage */
  const MembershipMessage =
    actionChatItemAction?.liveChatMembershipItemRenderer?.headerSubtext.runs
      .map((_) => "text" in _ && _.text)
      .join("");

  const [, MembershipType] =
    MembershipMessage?.match(MembershipLevelRegex) || [];

  /* ChatPaidMessage */
  const ChatPaidMessage =
    actionChatItemAction?.liveChatPaidMessageRenderer?.purchaseAmountText
      .simpleText;
  const [, currency, amountValue] =
    ChatPaidMessage?.replace("$", "").match(/([a-zA-Z-_]+?) *([0-9.]+)/) || [];

  return {
    continuation,
    currency: currency || void 0,
    amountValue,
    baseAmountValue:
      +amountValue /
        (exchange?.[AreaToCurrency?.[currency] || currency] || 1) || void 0,
    MembershipType,
    chat: parseChatData(data),
  };
};

export type parseChatType = Awaited<ReturnType<typeof parseChat>>;
