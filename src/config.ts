import jsYml from "js-yaml";

import { regexEscape, timeCalc } from "./utils";

const config = <ConfigType>jsYml.load("config.yml");

/**間隔獲取最新訊息 (ms) */
export const interval = config.interval;

/**頻道或直播網址 */
export const IDUrl = config.IDUrl;

/**匯率換算使用
 * @see https://api.exchangerate.host/latest
 */
export const AREA = config.AREA;

/**超級留言每元添加加班時間比
 * ex: 1元 = 1分鐘, 2元 = 2分鐘
 */
export const Proportion = config.Proportion;

/**加入會員添加加班時間
 * ex: 白銀臥胡 = 2.5分鐘
 */
export const MembershipLevel: ConfigType["MembershipLevel"] = Object.assign(
  {},
  ...Object.entries(config.Proportion).map(([key, value]) => ({
    [key]: timeCalc(value),
  }))
);

export const MembershipLevelRegex = new RegExp(
  `.*(${regexEscape(...Object.keys(MembershipLevel)).join("|")}).*`
);

export interface ConfigType {
  /**獲取最新訊息間隔 (ms) */
  interval: 1000;

  /**頻道或直播網址 */
  IDUrl: string;

  /**地區(匯率換算使用) https://api.exchangerate.host/latest */
  AREA: string;

  /**超級留言每元添加加班時間比
   * ex: 1元 = 1分鐘, 2元 = 2分鐘
   */
  Proportion: number;

  /**加入會員添加加班時間
   * ex: 白銀臥胡 = 2.5分鐘
   */
  MembershipLevel: Record<string, number>;
}
