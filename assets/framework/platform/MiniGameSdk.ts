/** 平台 SDK 的失败回调载荷只声明脚手架实际读取的字段。 */
export interface MiniGameSdkFailure {
  readonly errMsg?: string;
  readonly message?: string;
  readonly errCode?: string | number;
  readonly errNo?: string | number;
  readonly code?: string | number;
}

/** 微信和抖音常见的异步回调参数。 */
export interface MiniGameAsyncOptions<TResult> {
  readonly success?: (result: TResult) => void;
  readonly fail?: (failure: MiniGameSdkFailure) => void;
}

/** 原生广告错误载荷。 */
export type MiniGameAdFailure = MiniGameSdkFailure;

/** 激励视频关闭回调；抖音可能额外返回已观看次数。 */
export interface MiniGameRewardedCloseResult {
  readonly isEnded?: boolean;
  readonly count?: number;
}

/** SDK 激励视频对象的最小接口。 */
export interface MiniGameRewardedVideoAd {
  load(): PromiseLike<void> | void;
  show(): PromiseLike<void> | void;
  destroy?(): void;
  onClose(listener: (result?: MiniGameRewardedCloseResult) => void): void;
  offClose?(listener: (result?: MiniGameRewardedCloseResult) => void): void;
  onError(listener: (failure: MiniGameAdFailure) => void): void;
  offError?(listener: (failure: MiniGameAdFailure) => void): void;
}

/** SDK 插屏广告对象的最小接口。 */
export interface MiniGameInterstitialAd {
  load?(): PromiseLike<void> | void;
  show(): PromiseLike<void> | void;
  destroy?(): void;
  onError(listener: (failure: MiniGameAdFailure) => void): void;
  offError?(listener: (failure: MiniGameAdFailure) => void): void;
}

/** SDK Banner 的可变布局对象。 */
export interface MiniGameBannerStyle {
  left: number;
  top: number;
  width: number;
  height?: number;
}

/** SDK Banner 尺寸回调。 */
export interface MiniGameBannerResizeResult {
  readonly width: number;
  readonly height: number;
}

/** SDK Banner 广告对象的最小接口。 */
export interface MiniGameBannerAd {
  readonly style: MiniGameBannerStyle;
  show(): PromiseLike<void> | void;
  hide(): PromiseLike<void> | void;
  destroy?(): void;
  onResize?(listener: (result: MiniGameBannerResizeResult) => void): void;
  offResize?(listener: (result: MiniGameBannerResizeResult) => void): void;
  onError(listener: (failure: MiniGameAdFailure) => void): void;
  offError?(listener: (failure: MiniGameAdFailure) => void): void;
}

/** SDK 登录结果的公共字段。 */
export interface MiniGameLoginResult {
  readonly code?: string;
  readonly anonymousCode?: string;
  readonly isLogin?: boolean;
}

/** SDK 系统信息中脚手架需要归一化的字段。 */
export interface MiniGameSystemInfo {
  readonly brand?: string;
  readonly model?: string;
  readonly platform?: string;
  readonly system?: string;
  readonly language?: string;
  readonly SDKVersion?: string;
  readonly version?: string;
  readonly pixelRatio?: number;
  readonly screenWidth?: number;
  readonly screenHeight?: number;
  readonly windowWidth?: number;
  readonly windowHeight?: number;
  readonly safeArea?: {
    readonly left?: number;
    readonly top?: number;
    readonly right?: number;
    readonly bottom?: number;
    readonly width?: number;
    readonly height?: number;
  };
}

/** SDK 网络查询结果。 */
export interface MiniGameNetworkTypeResult {
  readonly networkType?: string;
}

/** SDK 网络变化结果。 */
export interface MiniGameNetworkChangeResult extends MiniGameNetworkTypeResult {
  readonly isConnected?: boolean;
}

/** SDK 启动参数中跨平台可复用的字段。 */
export interface MiniGameLaunchOptions {
  readonly scene?: number;
  readonly path?: string;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly referrerInfo?: {
    readonly appId?: string;
    readonly extraData?: unknown;
  };
}

/** SDK 检查更新结果。 */
export interface MiniGameUpdateCheckResult {
  readonly hasUpdate?: boolean;
}

/** 微信和抖音更新管理器的最小公共接口。 */
export interface MiniGameUpdateManager {
  onCheckForUpdate(listener: (result: MiniGameUpdateCheckResult) => void): void;
  offCheckForUpdate?(listener: (result: MiniGameUpdateCheckResult) => void): void;
  onUpdateReady(listener: () => void): void;
  offUpdateReady?(listener: () => void): void;
  onUpdateFailed(listener: (failure?: MiniGameSdkFailure) => void): void;
  offUpdateFailed?(listener: (failure?: MiniGameSdkFailure) => void): void;
  applyUpdate(): void;
}

/** SDK 分享消息参数。 */
export interface MiniGameShareMessageOptions extends MiniGameAsyncOptions<void> {
  readonly title?: string;
  readonly imageUrl?: string;
  readonly query?: string;
}

/** SDK 分享菜单参数。 */
export interface MiniGameShareMenuOptions extends MiniGameAsyncOptions<void> {
  readonly withShareTicket?: boolean;
  readonly menus?: readonly string[];
}

/**
 * 微信 wx 与抖音 tt 的最小公共接口。
 * 平台升级时只需扩展这里和具体服务，不让全局 SDK 类型污染业务代码。
 */
export interface MiniGameSdk {
  createRewardedVideoAd?(options: {
    readonly adUnitId: string;
  }): MiniGameRewardedVideoAd;
  createInterstitialAd?(options: {
    readonly adUnitId: string;
  }): MiniGameInterstitialAd;
  createBannerAd?(options: {
    readonly adUnitId: string;
    readonly style: MiniGameBannerStyle;
  }): MiniGameBannerAd;
  login?(options: MiniGameAsyncOptions<MiniGameLoginResult>): void;
  shareAppMessage?(options: MiniGameShareMessageOptions): void;
  showShareMenu?(options: MiniGameShareMenuOptions): void;
  getStorage?(options: MiniGameAsyncOptions<{ readonly data?: unknown }> & {
    readonly key: string;
  }): void;
  setStorage?(options: MiniGameAsyncOptions<void> & {
    readonly key: string;
    readonly data: unknown;
  }): void;
  removeStorage?(options: MiniGameAsyncOptions<void> & {
    readonly key: string;
  }): void;
  clearStorage?(options: MiniGameAsyncOptions<void>): void;
  getSystemInfoSync?(): MiniGameSystemInfo;
  getClipboardData?(options: MiniGameAsyncOptions<{ readonly data?: string }>): void;
  setClipboardData?(options: MiniGameAsyncOptions<void> & {
    readonly data: string;
  }): void;
  vibrateShort?(options: MiniGameAsyncOptions<void> & {
    readonly type?: 'light' | 'medium' | 'heavy';
  }): void;
  vibrateLong?(options: MiniGameAsyncOptions<void>): void;
  getNetworkType?(options: MiniGameAsyncOptions<MiniGameNetworkTypeResult>): void;
  onNetworkStatusChange?(listener: (result: MiniGameNetworkChangeResult) => void): void;
  offNetworkStatusChange?(listener: (result: MiniGameNetworkChangeResult) => void): void;
  getLaunchOptionsSync?(): MiniGameLaunchOptions;
  onShow?(listener: (options: MiniGameLaunchOptions) => void): void;
  offShow?(listener: (options: MiniGameLaunchOptions) => void): void;
  onHide?(listener: () => void): void;
  offHide?(listener: () => void): void;
  getUpdateManager?(): MiniGameUpdateManager;
}
