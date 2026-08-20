import { MiniGameAdvertisingService } from './Advertising';
import type { MiniGameSdk } from './MiniGameSdk';
import {
  MiniGameAccountService,
  MiniGameDeviceService,
  MiniGameLifecycleService,
  MiniGameNetworkService,
  MiniGameShareService,
  MiniGameStorageService,
  MiniGameUpdateService,
} from './MiniGameServices';
import type {
  PlatformCapabilities,
  PlatformKind,
  PlatformService,
} from './PlatformTypes';

type MiniGameKind = Exclude<PlatformKind, 'web'>;

/** 微信和抖音共享的组合根，具体平台类只负责确定平台身份和注入 SDK。 */
export abstract class MiniGamePlatformService implements PlatformService {
  public readonly capabilities: PlatformCapabilities;
  public readonly ads: MiniGameAdvertisingService;
  public readonly account: MiniGameAccountService;
  public readonly share: MiniGameShareService;
  public readonly storage: MiniGameStorageService;
  public readonly device: MiniGameDeviceService;
  public readonly network: MiniGameNetworkService;
  public readonly lifecycle: MiniGameLifecycleService;
  public readonly updates: MiniGameUpdateService;
  private destroyed = false;

  protected constructor(
    public readonly kind: MiniGameKind,
    protected readonly sdk: MiniGameSdk,
  ) {
    this.capabilities = {
      ads: {
        rewardedVideo: typeof sdk.createRewardedVideoAd === 'function',
        interstitial: typeof sdk.createInterstitialAd === 'function',
        banner: typeof sdk.createBannerAd === 'function',
      },
      login: typeof sdk.login === 'function',
      shareMessage: typeof sdk.shareAppMessage === 'function',
      shareMenu: typeof sdk.showShareMenu === 'function',
      timelineShare: kind === 'wechat' && typeof sdk.showShareMenu === 'function',
      storage: typeof sdk.getStorage === 'function'
        && typeof sdk.setStorage === 'function'
        && typeof sdk.removeStorage === 'function'
        && typeof sdk.clearStorage === 'function',
      clipboard: typeof sdk.getClipboardData === 'function' && typeof sdk.setClipboardData === 'function',
      vibration: typeof sdk.vibrateShort === 'function' && typeof sdk.vibrateLong === 'function',
      networkStatus: typeof sdk.getNetworkType === 'function'
        && typeof sdk.onNetworkStatusChange === 'function',
      lifecycleContext: typeof sdk.getLaunchOptionsSync === 'function'
        && typeof sdk.onShow === 'function'
        && typeof sdk.onHide === 'function',
      updates: typeof sdk.getUpdateManager === 'function',
    };
    this.ads = new MiniGameAdvertisingService(kind, sdk);
    this.account = new MiniGameAccountService(kind, sdk);
    this.share = new MiniGameShareService(kind, sdk);
    this.storage = new MiniGameStorageService(kind, sdk);
    this.device = new MiniGameDeviceService(kind, sdk);
    this.network = new MiniGameNetworkService(kind, sdk);
    this.lifecycle = new MiniGameLifecycleService(kind, sdk);
    this.updates = new MiniGameUpdateService(kind, sdk);
  }

  /** 集中释放广告对象与平台注册的网络、前后台监听。 */
  public destroy(): void {
    if (this.destroyed) return;
    this.ads.destroy();
    this.network.destroy();
    this.lifecycle.destroy();
    this.updates.destroy();
    this.destroyed = true;
  }
}
