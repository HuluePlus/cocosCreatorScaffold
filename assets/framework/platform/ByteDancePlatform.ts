import type { MiniGameSdk } from './MiniGameSdk';
import { MiniGamePlatformService } from './MiniGamePlatform';

/** 抖音小游戏平台实现。 */
export class ByteDancePlatformService extends MiniGamePlatformService {
  public constructor(sdk: MiniGameSdk) {
    super('bytedance', sdk);
  }
}
