import type { MiniGameSdk } from './MiniGameSdk';
import { MiniGamePlatformService } from './MiniGamePlatform';

/** 微信小游戏平台实现。 */
export class WeChatPlatformService extends MiniGamePlatformService {
  public constructor(sdk: MiniGameSdk) {
    super('wechat', sdk);
  }
}
