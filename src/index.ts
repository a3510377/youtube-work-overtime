import "./server";
import { LiveChat } from "./api";
import { addTime } from "./server";
import { IDUrl, interval, MembershipLevel, Proportion } from "./config";

process
  .on("uncaughtException", (er: Error) => console.error(er))
  .on("unhandledRejection", (er: Error) => console.error(er));

const chat = new LiveChat(IDUrl, interval);

console.log("\x1b[35m%s\x1b[0m", "正在監聽直播間...");
console.log("\x1b[35m%s\x1b[0m", `直播間 ID: ${IDUrl}`);

chat
  .on("chat", (data) => {
    console.log(
      `${data.author.name} > ${data.message
        .map((s) => {
          if ("emojiText" in s && s.emojiText) return s.emojiText;
          if ("text" in s && s.text) return s.text;

          return "";
        })
        .join("")}`
    );
  })
  .on("newMembership", ({ MembershipType }) => {
    if (!MembershipType) return;

    console.log("\x1b[36m%s\x1b[0m", `新的會員:${MembershipType}`);

    addTime(`+:${MembershipLevel?.[MembershipType] || 0}`);
  })
  .on("newPaidMessage", ({ currency, amountValue, baseAmountValue }) => {
    // 我懶所以多寫 if 一次不過沒差
    if (!baseAmountValue) return;

    console.log(
      "\x1b[36m",
      "新的超級留言:",
      `${currency ? currency + " " : ""}${amountValue} ->`,
      baseAmountValue,
      "\x1b[0m"
    );

    addTime(`+:${baseAmountValue * Proportion}`);
  });
