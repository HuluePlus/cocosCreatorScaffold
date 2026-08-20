import type { Unsubscribe } from '../core/EventBus';
import type {
  MiniGameAdFailure,
  MiniGameBannerAd,
  MiniGameBannerResizeResult,
  MiniGameInterstitialAd,
  MiniGameRewardedCloseResult,
  MiniGameRewardedVideoAd,
  MiniGameSdk,
} from './MiniGameSdk';
import { featureUnavailable, toPlatformError } from './PlatformErrors';
import {
  PlatformError,
  type AdvertisingService,
  type BannerAd,
  type BannerAdOptions,
  type BannerAdSize,
  type BannerAdStyle,
  type InterstitialAd,
  type InterstitialAdOptions,
  type PlatformKind,
  type RewardedVideoAd,
  type RewardedVideoAdOptions,
  type RewardedVideoResult,
} from './PlatformTypes';

interface ManagedAd {
  readonly destroyed: boolean;
  destroy(): void;
}

/** 复用广告销毁检查和错误订阅逻辑。 */
class ManagedAdSupport {
  private readonly errorListeners = new Set<(error: PlatformError) => void>();
  private destroyedValue = false;

  public constructor(private readonly platform: PlatformKind) {}

  public get destroyed(): boolean {
    return this.destroyedValue;
  }

  /** 监听已归一化的原生广告错误。 */
  public onError(listener: (error: PlatformError) => void): Unsubscribe {
    this.ensureAlive('ad.onError');
    this.errorListeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.errorListeners.delete(listener);
    };
  }

  /** 将 SDK 错误分发给业务监听器。 */
  public publishError(operation: string, failure: unknown): PlatformError {
    const error = toPlatformError(this.platform, operation, failure);
    for (const listener of Array.from(this.errorListeners)) listener(error);
    return error;
  }

  /** 广告销毁后拒绝继续调用。 */
  public ensureAlive(operation: string): void {
    if (this.destroyedValue) {
      throw new PlatformError(
        this.platform,
        operation,
        'The advertising handle has been destroyed',
        'AD_DESTROYED',
      );
    }
  }

  /** 标记销毁并释放业务错误监听器。 */
  public destroy(): void {
    this.destroyedValue = true;
    this.errorListeners.clear();
  }
}

interface PendingRewardedShow {
  readonly resolve: (result: RewardedVideoResult) => void;
  readonly reject: (error: PlatformError) => void;
}

/** 微信和抖音共用的激励视频控制器。 */
class MiniGameRewardedVideo implements RewardedVideoAd {
  private readonly managed: ManagedAdSupport;
  private loadTask: Promise<void> | null = null;
  private pendingShow: PendingRewardedShow | null = null;
  private startingShow = false;
  private destroyedValue = false;
  private readonly closeListener: (result?: MiniGameRewardedCloseResult) => void;
  private readonly errorListener: (failure: MiniGameAdFailure) => void;

  public constructor(
    public readonly adUnitId: string,
    private readonly platform: PlatformKind,
    private readonly nativeAd: MiniGameRewardedVideoAd,
    private readonly onDestroyed: () => void,
  ) {
    this.managed = new ManagedAdSupport(platform);
    this.closeListener = (result) => this.handleClose(result);
    this.errorListener = (failure) => this.handleError(failure);
    this.nativeAd.onClose(this.closeListener);
    this.nativeAd.onError(this.errorListener);
  }

  public get destroyed(): boolean {
    return this.destroyedValue;
  }

  /** 复用同一次加载任务，避免连续点击重复请求广告库存。 */
  public load(): Promise<void> {
    this.managed.ensureAlive('ads.rewarded.load');
    if (this.loadTask) return this.loadTask;
    const task = this.invoke('ads.rewarded.load', () => this.nativeAd.load());
    this.loadTask = task;
    void task.then(
      () => this.clearLoadTask(task),
      () => this.clearLoadTask(task),
    );
    return task;
  }

  /** 加载并展示广告，直到收到关闭回调后返回是否满足发奖条件。 */
  public async show(): Promise<RewardedVideoResult> {
    this.managed.ensureAlive('ads.rewarded.show');
    if (this.startingShow || this.pendingShow) {
      throw new PlatformError(
        this.platform,
        'ads.rewarded.show',
        'A rewarded video is already being shown',
        'AD_BUSY',
      );
    }

    this.startingShow = true;
    try {
      await this.load();
      this.managed.ensureAlive('ads.rewarded.show');
      return await new Promise<RewardedVideoResult>((resolve, reject) => {
        this.pendingShow = { resolve, reject };
        this.startingShow = false;
        void this.invoke('ads.rewarded.show', () => this.nativeAd.show())
          .catch((failure: unknown) => this.rejectPending(failure));
      });
    } catch (failure) {
      this.startingShow = false;
      throw toPlatformError(this.platform, 'ads.rewarded.show', failure);
    }
  }

  public onError(listener: (error: PlatformError) => void): Unsubscribe {
    return this.managed.onError(listener);
  }

  /** 移除 SDK 监听并拒绝尚未结束的展示请求。 */
  public destroy(): void {
    if (this.destroyedValue) return;
    const pending = this.pendingShow;
    this.pendingShow = null;
    if (pending) {
      pending.reject(new PlatformError(
        this.platform,
        'ads.rewarded.show',
        'The rewarded video was destroyed before it closed',
        'AD_DESTROYED',
      ));
    }
    this.nativeAd.offClose?.(this.closeListener);
    this.nativeAd.offError?.(this.errorListener);
    this.nativeAd.destroy?.();
    this.destroyedValue = true;
    this.managed.destroy();
    this.onDestroyed();
  }

  private clearLoadTask(task: Promise<void>): void {
    if (this.loadTask === task) this.loadTask = null;
  }

  private async invoke(operation: string, action: () => PromiseLike<void> | void): Promise<void> {
    try {
      await action();
    } catch (failure) {
      throw toPlatformError(this.platform, operation, failure);
    }
  }

  private handleClose(result?: MiniGameRewardedCloseResult): void {
    const pending = this.pendingShow;
    if (!pending) return;
    this.pendingShow = null;
    const suppliedCount = result?.count;
    const watchedCount = typeof suppliedCount === 'number' && Number.isFinite(suppliedCount)
      ? Math.max(0, Math.floor(suppliedCount))
      : result?.isEnded === false ? 0 : 1;
    pending.resolve({
      completed: result?.isEnded ?? watchedCount > 0,
      watchedCount,
    });
  }

  private handleError(failure: MiniGameAdFailure): void {
    const error = this.managed.publishError('ads.rewarded', failure);
    const pending = this.pendingShow;
    if (!pending) return;
    this.pendingShow = null;
    pending.reject(error);
  }

  private rejectPending(failure: unknown): void {
    const pending = this.pendingShow;
    if (!pending) return;
    this.pendingShow = null;
    pending.reject(toPlatformError(this.platform, 'ads.rewarded.show', failure));
  }
}

/** 微信和抖音共用的插屏广告控制器。 */
class MiniGameInterstitial implements InterstitialAd {
  private readonly errorListeners = new Set<(error: PlatformError) => void>();
  private loadTask: Promise<void> | null = null;
  private showing = false;
  private destroyedValue = false;
  private readonly errorListener: (failure: MiniGameAdFailure) => void;

  public constructor(
    public readonly adUnitId: string,
    private readonly platform: PlatformKind,
    private readonly nativeAd: MiniGameInterstitialAd,
    private readonly onDestroyed: () => void,
  ) {
    this.errorListener = (failure) => {
      const error = toPlatformError(this.platform, 'ads.interstitial', failure);
      for (const listener of Array.from(this.errorListeners)) listener(error);
    };
    this.nativeAd.onError(this.errorListener);
  }

  public get destroyed(): boolean {
    return this.destroyedValue;
  }

  public load(): Promise<void> {
    this.assertAlive('ads.interstitial.load');
    if (!this.nativeAd.load) return Promise.resolve();
    if (this.loadTask) return this.loadTask;
    const task = this.invoke('ads.interstitial.load', () => this.nativeAd.load?.());
    this.loadTask = task;
    void task.then(
      () => this.clearLoadTask(task),
      () => this.clearLoadTask(task),
    );
    return task;
  }

  /** 同一插屏句柄不允许并发展示。 */
  public async show(): Promise<void> {
    this.assertAlive('ads.interstitial.show');
    if (this.showing) {
      throw new PlatformError(
        this.platform,
        'ads.interstitial.show',
        'An interstitial ad is already being shown',
        'AD_BUSY',
      );
    }
    this.showing = true;
    try {
      await this.load();
      this.assertAlive('ads.interstitial.show');
      await this.invoke('ads.interstitial.show', () => this.nativeAd.show());
    } finally {
      this.showing = false;
    }
  }

  public onError(listener: (error: PlatformError) => void): Unsubscribe {
    this.assertAlive('ads.interstitial.onError');
    this.errorListeners.add(listener);
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      this.errorListeners.delete(listener);
    };
  }

  public destroy(): void {
    if (this.destroyedValue) return;
    this.nativeAd.offError?.(this.errorListener);
    this.nativeAd.destroy?.();
    this.destroyedValue = true;
    this.errorListeners.clear();
    this.onDestroyed();
  }

  private assertAlive(operation: string): void {
    if (this.destroyedValue) {
      throw new PlatformError(this.platform, operation, 'The interstitial ad has been destroyed', 'AD_DESTROYED');
    }
  }

  private clearLoadTask(task: Promise<void>): void {
    if (this.loadTask === task) this.loadTask = null;
  }

  private async invoke(operation: string, action: () => PromiseLike<void> | void): Promise<void> {
    try {
      await action();
    } catch (failure) {
      throw toPlatformError(this.platform, operation, failure);
    }
  }
}

/** 微信和抖音共用的 Banner 广告控制器。 */
class MiniGameBanner implements BannerAd {
  private readonly resizeListeners = new Set<(size: BannerAdSize) => void>();
  private readonly errorListeners = new Set<(error: PlatformError) => void>();
  private destroyedValue = false;
  private readonly resizeListener: (result: MiniGameBannerResizeResult) => void;
  private readonly errorListener: (failure: MiniGameAdFailure) => void;

  public constructor(
    private readonly platform: PlatformKind,
    private readonly nativeAd: MiniGameBannerAd,
    private readonly onDestroyed: () => void,
  ) {
    this.resizeListener = (result) => {
      const size = { width: result.width, height: result.height };
      for (const listener of Array.from(this.resizeListeners)) listener(size);
    };
    this.errorListener = (failure) => {
      const error = toPlatformError(this.platform, 'ads.banner', failure);
      for (const listener of Array.from(this.errorListeners)) listener(error);
    };
    this.nativeAd.onResize?.(this.resizeListener);
    this.nativeAd.onError(this.errorListener);
  }

  public get destroyed(): boolean {
    return this.destroyedValue;
  }

  public show(): Promise<void> {
    return this.invoke('ads.banner.show', () => this.nativeAd.show());
  }

  public hide(): Promise<void> {
    return this.invoke('ads.banner.hide', () => this.nativeAd.hide());
  }

  /** 直接更新原生样式对象，保证广告展示期间也能响应安全区变化。 */
  public updateStyle(style: BannerAdStyle): void {
    this.assertAlive('ads.banner.updateStyle');
    this.nativeAd.style.left = style.left;
    this.nativeAd.style.top = style.top;
    this.nativeAd.style.width = style.width;
    if (style.height === undefined) delete this.nativeAd.style.height;
    else this.nativeAd.style.height = style.height;
  }

  public onResize(listener: (size: BannerAdSize) => void): Unsubscribe {
    this.assertAlive('ads.banner.onResize');
    this.resizeListeners.add(listener);
    return this.unsubscribeFrom(this.resizeListeners, listener);
  }

  public onError(listener: (error: PlatformError) => void): Unsubscribe {
    this.assertAlive('ads.banner.onError');
    this.errorListeners.add(listener);
    return this.unsubscribeFrom(this.errorListeners, listener);
  }

  public destroy(): void {
    if (this.destroyedValue) return;
    this.nativeAd.offResize?.(this.resizeListener);
    this.nativeAd.offError?.(this.errorListener);
    this.nativeAd.destroy?.();
    this.destroyedValue = true;
    this.resizeListeners.clear();
    this.errorListeners.clear();
    this.onDestroyed();
  }

  private unsubscribeFrom<T>(listeners: Set<T>, listener: T): Unsubscribe {
    let subscribed = true;
    return () => {
      if (!subscribed) return;
      subscribed = false;
      listeners.delete(listener);
    };
  }

  private assertAlive(operation: string): void {
    if (this.destroyedValue) {
      throw new PlatformError(this.platform, operation, 'The banner ad has been destroyed', 'AD_DESTROYED');
    }
  }

  private async invoke(operation: string, action: () => PromiseLike<void> | void): Promise<void> {
    this.assertAlive(operation);
    try {
      await action();
    } catch (failure) {
      throw toPlatformError(this.platform, operation, failure);
    }
  }
}

/** 基于 wx 或 tt 原生对象实现的广告服务。 */
export class MiniGameAdvertisingService implements AdvertisingService {
  private readonly handles = new Set<ManagedAd>();
  private rewarded: MiniGameRewardedVideo | null = null;
  private interstitial: MiniGameInterstitial | null = null;
  private destroyed = false;

  public constructor(
    private readonly platform: Exclude<PlatformKind, 'web'>,
    private readonly sdk: MiniGameSdk,
  ) {}

  /** 激励视频在两个平台默认都是全局单例，同一服务只保留一个句柄。 */
  public createRewardedVideo(options: RewardedVideoAdOptions): RewardedVideoAd {
    this.assertServiceAlive('ads.createRewardedVideo');
    this.assertAdUnitId(options.adUnitId, 'ads.createRewardedVideo');
    if (this.rewarded && !this.rewarded.destroyed) {
      if (this.rewarded.adUnitId === options.adUnitId) return this.rewarded;
      throw new PlatformError(
        this.platform,
        'ads.createRewardedVideo',
        'Destroy the existing rewarded video before using another ad unit',
        'AD_SINGLETON_CONFLICT',
      );
    }
    const create = this.sdk.createRewardedVideoAd;
    if (!create) throw featureUnavailable(this.platform, 'ads.createRewardedVideo');
    try {
      const controller = new MiniGameRewardedVideo(
        options.adUnitId,
        this.platform,
        create.call(this.sdk, { adUnitId: options.adUnitId }),
        () => {
          this.handles.delete(controller);
          if (this.rewarded === controller) this.rewarded = null;
        },
      );
      this.rewarded = controller;
      this.handles.add(controller);
      return controller;
    } catch (failure) {
      throw toPlatformError(this.platform, 'ads.createRewardedVideo', failure);
    }
  }

  /** 插屏广告同样按广告位复用，避免重复注册原生监听。 */
  public createInterstitial(options: InterstitialAdOptions): InterstitialAd {
    this.assertServiceAlive('ads.createInterstitial');
    this.assertAdUnitId(options.adUnitId, 'ads.createInterstitial');
    if (this.interstitial && !this.interstitial.destroyed) {
      if (this.interstitial.adUnitId === options.adUnitId) return this.interstitial;
      throw new PlatformError(
        this.platform,
        'ads.createInterstitial',
        'Destroy the existing interstitial before using another ad unit',
        'AD_SINGLETON_CONFLICT',
      );
    }
    const create = this.sdk.createInterstitialAd;
    if (!create) throw featureUnavailable(this.platform, 'ads.createInterstitial');
    try {
      const controller = new MiniGameInterstitial(
        options.adUnitId,
        this.platform,
        create.call(this.sdk, { adUnitId: options.adUnitId }),
        () => {
          this.handles.delete(controller);
          if (this.interstitial === controller) this.interstitial = null;
        },
      );
      this.interstitial = controller;
      this.handles.add(controller);
      return controller;
    } catch (failure) {
      throw toPlatformError(this.platform, 'ads.createInterstitial', failure);
    }
  }

  /** Banner 允许多个实例，由服务统一回收。 */
  public createBanner(options: BannerAdOptions): BannerAd {
    this.assertServiceAlive('ads.createBanner');
    this.assertAdUnitId(options.adUnitId, 'ads.createBanner');
    this.assertBannerStyle(options.style);
    const create = this.sdk.createBannerAd;
    if (!create) throw featureUnavailable(this.platform, 'ads.createBanner');
    try {
      let controller: MiniGameBanner;
      controller = new MiniGameBanner(
        this.platform,
        create.call(this.sdk, {
          adUnitId: options.adUnitId,
          style: { ...options.style },
        }),
        () => this.handles.delete(controller),
      );
      this.handles.add(controller);
      return controller;
    } catch (failure) {
      throw toPlatformError(this.platform, 'ads.createBanner', failure);
    }
  }

  /** 销毁所有仍存活的广告句柄。 */
  public destroy(): void {
    if (this.destroyed) return;
    for (const handle of Array.from(this.handles)) handle.destroy();
    this.handles.clear();
    this.rewarded = null;
    this.interstitial = null;
    this.destroyed = true;
  }

  private assertServiceAlive(operation: string): void {
    if (this.destroyed) {
      throw new PlatformError(this.platform, operation, 'The advertising service has been destroyed', 'SERVICE_DESTROYED');
    }
  }

  private assertAdUnitId(adUnitId: string, operation: string): void {
    if (adUnitId.trim().length === 0) {
      throw new PlatformError(this.platform, operation, 'adUnitId must not be empty', 'INVALID_ARGUMENT');
    }
  }

  private assertBannerStyle(style: BannerAdStyle): void {
    const values = [style.left, style.top, style.width];
    if (style.height !== undefined) values.push(style.height);
    if (values.some((value) => !Number.isFinite(value)) || style.width <= 0) {
      throw new PlatformError(
        this.platform,
        'ads.createBanner',
        'Banner style values must be finite and width must be positive',
        'INVALID_ARGUMENT',
      );
    }
  }
}

/** Web 预览和不支持广告的平台使用的显式降级服务。 */
export class UnavailableAdvertisingService implements AdvertisingService {
  public constructor(private readonly platform: PlatformKind) {}

  public createRewardedVideo(_options: RewardedVideoAdOptions): RewardedVideoAd {
    throw featureUnavailable(this.platform, 'ads.createRewardedVideo');
  }

  public createInterstitial(_options: InterstitialAdOptions): InterstitialAd {
    throw featureUnavailable(this.platform, 'ads.createInterstitial');
  }

  public createBanner(_options: BannerAdOptions): BannerAd {
    throw featureUnavailable(this.platform, 'ads.createBanner');
  }

  public destroy(): void {}
}
