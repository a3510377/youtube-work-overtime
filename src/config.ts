import fs from "fs";

import jsYml from "js-yaml";
import path from "path";

import { regexEscape, timeCalc } from "./utils";
import { defaultConfig } from "./utils/data";

const config = <ConfigType>jsYml.load(defaultConfig);
const configFile = path.join(__dirname, "..", "config.yml");

try {
  Object.assign(config, jsYml.load(fs.readFileSync(configFile, "utf8")));
} catch {
  fs.writeFileSync(configFile, defaultConfig, { encoding: "utf8" });
}

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
  ...Object.entries(config.MembershipLevel).map(([key, value]) => ({
    [key]: timeCalc(<string>(<unknown>value)),
  }))
);

export const MembershipLevelRegex = new RegExp(
  `.*(${regexEscape(...Object.keys(MembershipLevel)).join("|")}).*`
);

export interface ConfigType {
  /**獲取最新訊息間隔 (ms) */
  interval: number;

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
