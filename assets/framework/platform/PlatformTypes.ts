import type { Unsubscribe } from '../core/EventBus';

/** 脚手架当前可识别的平台种类。 */
export type PlatformKind = 'wechat' | 'bytedance' | 'web';

/** 归一化后的操作系统名称。 */
export type OperatingSystem = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'unknown';

/** 归一化后的网络类型。 */
export type NetworkType = 'wifi' | '2g' | '3g' | '4g' | '5g' | 'ethernet' | 'none' | 'unknown';

/** 可安全写入平台缓存或浏览器缓存的数据。 */
export type StorageValue =
  | string
  | number
  | boolean
  | null
  | readonly StorageValue[]
  | { readonly [key: string]: StorageValue };

/** 平台能力探测结果，业务调用可选能力前应先检查对应字段。 */
export interface PlatformCapabilities {
  readonly ads: {
    readonly rewardedVideo: boolean;
    readonly interstitial: boolean;
    readonly banner: boolean;
  };
  readonly login: boolean;
  readonly shareMessage: boolean;
  readonly shareMenu: boolean;
  readonly timelineShare: boolean;
  readonly storage: boolean;
  readonly clipboard: boolean;
  readonly vibration: boolean;
  readonly networkStatus: boolean;
  readonly lifecycleContext: boolean;
  readonly updates: boolean;
}

/** 平台操作失败时抛出的统一错误。 */
export class PlatformError extends Error {
  public override readonly name = 'PlatformError';

  public constructor(
    public readonly platform: PlatformKind,
    public readonly operation: string,
    message: string,
    public readonly code: string | number | null = null,
    public readonly detail: unknown = null,
  ) {
    super(message);
  }
}

/** 激励视频广告创建参数。 */
export interface RewardedVideoAdOptions {
  readonly adUnitId: string;
}

/** 激励视频关闭后的统一结果。 */
export interface RewardedVideoResult {
  readonly completed: boolean;
  readonly watchedCount: number;
}

/** 激励视频广告句柄。 */
export interface RewardedVideoAd {
  readonly destroyed: boolean;
  load(): Promise<void>;
  show(): Promise<RewardedVideoResult>;
  onError(listener: (error: PlatformError) => void): Unsubscribe;
  destroy(): void;
}

/** 插屏广告创建参数。 */
export interface InterstitialAdOptions {
  readonly adUnitId: string;
}

/** 插屏广告句柄。 */
export interface InterstitialAd {
  readonly destroyed: boolean;
  load(): Promise<void>;
  show(): Promise<void>;
  onError(listener: (error: PlatformError) => void): Unsubscribe;
  destroy(): void;
}

/** Banner 广告布局，坐标使用平台窗口的逻辑像素。 */
export interface BannerAdStyle {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height?: number;
}

/** Banner 广告创建参数。 */
export interface BannerAdOptions {
  readonly adUnitId: string;
  readonly style: BannerAdStyle;
}

/** Banner 广告实际尺寸。 */
export interface BannerAdSize {
  readonly width: number;
  readonly height: number;
}

/** Banner 广告句柄。 */
export interface BannerAd {
  readonly destroyed: boolean;
  show(): Promise<void>;
  hide(): Promise<void>;
  updateStyle(style: BannerAdStyle): void;
  onResize(listener: (size: BannerAdSize) => void): Unsubscribe;
  onError(listener: (error: PlatformError) => void): Unsubscribe;
  destroy(): void;
}

/** 广告服务负责创建并集中销毁当前平台的原生广告对象。 */
export interface AdvertisingService {
  createRewardedVideo(options: RewardedVideoAdOptions): RewardedVideoAd;
  createInterstitial(options: InterstitialAdOptions): InterstitialAd;
  createBanner(options: BannerAdOptions): BannerAd;
  destroy(): void;
}

/** 平台登录换取的短期凭据，必须交给业务服务端继续校验。 */
export interface LoginResult {
  readonly code: string;
  readonly anonymousCode: string | null;
  readonly alreadyLoggedIn: boolean | null;
}

/** 平台账号服务只处理客户端登录，不保存业务用户态。 */
export interface AccountService {
  login(): Promise<LoginResult>;
}

/** 分享消息中可跨微信和抖音复用的字段。 */
export interface ShareMessage {
  readonly title?: string;
  readonly imageUrl?: string;
  readonly query?: string;
}

/** 分享菜单支持的通用目标。 */
export type ShareChannel = 'message' | 'timeline';

/** 分享菜单配置。 */
export interface ShareMenuOptions {
  readonly channels?: readonly ShareChannel[];
  readonly withShareTicket?: boolean;
}

/** 分享调用只保证面板已发起，不把平台回调误当成分享成功证明。 */
export interface ShareService {
  share(message: ShareMessage): Promise<void>;
  showMenu(options?: ShareMenuOptions): Promise<void>;
}

/** 平台键值缓存。 */
export interface StorageService {
  get(key: string): Promise<StorageValue | null>;
  set(key: string, value: StorageValue): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

/** 屏幕或安全区矩形，坐标原点位于平台窗口左上角。 */
export interface PlatformRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** 归一化后的设备和窗口信息。 */
export interface PlatformSystemInfo {
  readonly brand: string;
  readonly model: string;
  readonly operatingSystem: OperatingSystem;
  readonly systemVersion: string;
  readonly language: string;
  readonly platformVersion: string;
  readonly pixelRatio: number;
  readonly screen: PlatformRect;
  readonly window: PlatformRect;
  readonly safeArea: PlatformRect;
}

/** 短震动的强度提示；不支持强度的平台会忽略该差异。 */
export type VibrationStyle = 'light' | 'medium' | 'heavy';

/** 设备服务屏蔽安全区、剪贴板和震动 API 的平台差异。 */
export interface DeviceService {
  getSystemInfo(): PlatformSystemInfo;
  getClipboardText(): Promise<string>;
  setClipboardText(text: string): Promise<void>;
  vibrateShort(style?: VibrationStyle): Promise<void>;
  vibrateLong(): Promise<void>;
}

/** 当前网络状态。 */
export interface NetworkStatus {
  readonly connected: boolean;
  readonly type: NetworkType;
}

/** 网络状态服务。 */
export interface NetworkService {
  getStatus(): Promise<NetworkStatus>;
  onChange(listener: (status: NetworkStatus) => void): Unsubscribe;
  destroy(): void;
}

/** 从外部入口启动或重新显示小游戏时的通用上下文。 */
export interface LaunchContext {
  readonly scene: number | null;
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  readonly referrerAppId: string | null;
  readonly referrerExtraData: unknown;
}

/** 平台前后台事件，保留 Cocos 基础生命周期没有提供的启动参数。 */
export interface PlatformLifecycleService {
  getLaunchContext(): LaunchContext;
  onShow(listener: (context: LaunchContext) => void): Unsubscribe;
  onHide(listener: () => void): Unsubscribe;
  destroy(): void;
}

/** 平台检查新版本后的结果。 */
export interface UpdateCheckResult {
  readonly hasUpdate: boolean;
}

/** 小游戏平台更新管理服务。 */
export interface PlatformUpdateService {
  onCheck(listener: (result: UpdateCheckResult) => void): Unsubscribe;
  onReady(listener: () => void): Unsubscribe;
  onFailed(listener: (error: PlatformError) => void): Unsubscribe;
  apply(): void;
  destroy(): void;
}

/** 业务层唯一需要持有的平台组合服务。 */
export interface PlatformService {
  readonly kind: PlatformKind;
  readonly capabilities: PlatformCapabilities;
  readonly ads: AdvertisingService;
  readonly account: AccountService;
  readonly share: ShareService;
  readonly storage: StorageService;
  readonly device: DeviceService;
  readonly network: NetworkService;
  readonly lifecycle: PlatformLifecycleService;
  readonly updates: PlatformUpdateService;
  destroy(): void;
}
