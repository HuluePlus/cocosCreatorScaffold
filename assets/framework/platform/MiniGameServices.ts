import type { Unsubscribe } from '../core/EventBus';
import type {
  MiniGameAsyncOptions,
  MiniGameLaunchOptions,
  MiniGameLoginResult,
  MiniGameNetworkChangeResult,
  MiniGameNetworkTypeResult,
  MiniGameSdk,
  MiniGameSdkFailure,
  MiniGameSystemInfo,
  MiniGameUpdateCheckResult,
  MiniGameUpdateManager,
} from './MiniGameSdk';
import { featureUnavailable, toPlatformError } from './PlatformErrors';
import {
  PlatformError,
  type AccountService,
  type DeviceService,
  type LaunchContext,
  type LoginResult,
  type NetworkService,
  type NetworkStatus,
  type NetworkType,
  type OperatingSystem,
  type PlatformKind,
  type PlatformLifecycleService,
  type PlatformRect,
  type PlatformSystemInfo,
  type PlatformUpdateService,
  type ShareChannel,
  type ShareMenuOptions,
  type ShareMessage,
  type ShareService,
  type StorageService,
  type StorageValue,
  type VibrationStyle,
  type UpdateCheckResult,
} from './PlatformTypes';

type MiniGameKind = Exclude<PlatformKind, 'web'>;

/** 将 SDK 的 success/fail 回调统一成 Promise。 */
function invokeWithCallbacks<TResult>(
  platform: MiniGameKind,
  operation: string,
  invoke: (options: MiniGameAsyncOptions<TResult>) => void,
): Promise<TResult> {
  return new Promise<TResult>((resolve, reject) => {
    try {
      invoke({
        success: resolve,
        fail: (failure) => reject(toPlatformError(platform, operation, failure)),
      });
    } catch (failure) {
      reject(toPlatformError(platform, operation, failure));
    }
  });
}

/** 判断读取缓存失败是否只是键不存在。 */
function isMissingStorageFailure(failure: MiniGameSdkFailure): boolean {
  const message = failure.errMsg ?? failure.message ?? '';
  return /not\s*found|no\s+such|不存在/i.test(message);
}

/** 运行时校验平台返回的数据仍属于脚手架支持的缓存值。 */
function isStorageValue(value: unknown, visiting = new Set<object>()): value is StorageValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object') return false;
  if (visiting.has(value)) return false;
  visiting.add(value);

  let valid = true;
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!isStorageValue(item, visiting)) {
        valid = false;
        break;
      }
    }
  } else {
    for (const key of Object.keys(value)) {
      const entry = (value as Readonly<Record<string, unknown>>)[key];
      if (!isStorageValue(entry, visiting)) {
        valid = false;
        break;
      }
    }
  }
  visiting.delete(value);
  return valid;
}

/** 微信和抖音登录服务。 */
export class MiniGameAccountService implements AccountService {
  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  /** 获取短期登录凭据，不在客户端建立业务会话。 */
  public async login(): Promise<LoginResult> {
    const login = this.sdk.login;
    if (!login) throw featureUnavailable(this.platform, 'account.login');
    const result = await invokeWithCallbacks<MiniGameLoginResult>(
      this.platform,
      'account.login',
      (options) => login.call(this.sdk, options),
    );
    if (typeof result.code !== 'string' || result.code.length === 0) {
      throw new PlatformError(
        this.platform,
        'account.login',
        'The platform did not return a login code',
        'INVALID_SDK_RESULT',
        result,
      );
    }
    return {
      code: result.code,
      anonymousCode: typeof result.anonymousCode === 'string' ? result.anonymousCode : null,
      alreadyLoggedIn: typeof result.isLogin === 'boolean' ? result.isLogin : null,
    };
  }
}

/** 微信和抖音分享服务。 */
export class MiniGameShareService implements ShareService {
  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  /**
   * 发起分享面板后立即完成 Promise。
   * 平台回调不能作为好友实际收到或点击分享的证明，因此不向业务承诺分享成功。
   */
  public async share(message: ShareMessage): Promise<void> {
    const share = this.sdk.shareAppMessage;
    if (!share) throw featureUnavailable(this.platform, 'share.message');
    try {
      share.call(this.sdk, {
        title: message.title,
        imageUrl: message.imageUrl,
        query: message.query,
      });
    } catch (failure) {
      throw toPlatformError(this.platform, 'share.message', failure);
    }
  }

  /** 展示平台分享入口，并把通用渠道映射为原生菜单名。 */
  public async showMenu(options: ShareMenuOptions = {}): Promise<void> {
    const showMenu = this.sdk.showShareMenu;
    if (!showMenu) throw featureUnavailable(this.platform, 'share.showMenu');
    const channels = options.channels ?? ['message'];
    if (this.platform === 'bytedance' && channels.includes('timeline')) {
      throw featureUnavailable(this.platform, 'share.timeline');
    }
    const menus = channels.map((channel) => this.nativeMenuName(channel));
    await invokeWithCallbacks(
      this.platform,
      'share.showMenu',
      (callbacks) => showMenu.call(this.sdk, {
        ...callbacks,
        menus,
        withShareTicket: options.withShareTicket,
      }),
    );
  }

  private nativeMenuName(channel: ShareChannel): string {
    return channel === 'timeline' ? 'shareTimeline' : 'shareAppMessage';
  }
}

/** 微信和抖音异步缓存服务。 */
export class MiniGameStorageService implements StorageService {
  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  public get(key: string): Promise<StorageValue | null> {
    this.assertKey(key);
    const getStorage = this.sdk.getStorage;
    if (!getStorage) return Promise.reject(featureUnavailable(this.platform, 'storage.get'));
    return new Promise<StorageValue | null>((resolve, reject) => {
      try {
        getStorage.call(this.sdk, {
          key,
          success: (result) => {
            if (result.data === undefined) {
              resolve(null);
              return;
            }
            if (!isStorageValue(result.data)) {
              reject(new PlatformError(
                this.platform,
                'storage.get',
                'The stored value is not serializable',
                'INVALID_SDK_RESULT',
                result.data,
              ));
              return;
            }
            resolve(result.data);
          },
          fail: (failure) => {
            if (isMissingStorageFailure(failure)) resolve(null);
            else reject(toPlatformError(this.platform, 'storage.get', failure));
          },
        });
      } catch (failure) {
        reject(toPlatformError(this.platform, 'storage.get', failure));
      }
    });
  }

  public async set(key: string, value: StorageValue): Promise<void> {
    this.assertKey(key);
    const setStorage = this.sdk.setStorage;
    if (!setStorage) throw featureUnavailable(this.platform, 'storage.set');
    if (!isStorageValue(value)) {
      throw new PlatformError(
        this.platform,
        'storage.set',
        'The storage value must be finite and serializable',
        'INVALID_ARGUMENT',
      );
    }
    await invokeWithCallbacks(
      this.platform,
      'storage.set',
      (callbacks) => setStorage.call(this.sdk, { ...callbacks, key, data: value }),
    );
  }

  public async remove(key: string): Promise<void> {
    this.assertKey(key);
    const removeStorage = this.sdk.removeStorage;
    if (!removeStorage) throw featureUnavailable(this.platform, 'storage.remove');
    await invokeWithCallbacks(
      this.platform,
      'storage.remove',
      (callbacks) => removeStorage.call(this.sdk, { ...callbacks, key }),
    );
  }

  public async clear(): Promise<void> {
    const clearStorage = this.sdk.clearStorage;
    if (!clearStorage) throw featureUnavailable(this.platform, 'storage.clear');
    await invokeWithCallbacks(
      this.platform,
      'storage.clear',
      (callbacks) => clearStorage.call(this.sdk, callbacks),
    );
  }

  private assertKey(key: string): void {
    if (key.trim().length === 0) {
      throw new PlatformError(this.platform, 'storage', 'Storage key must not be empty', 'INVALID_ARGUMENT');
    }
  }
}

/** 微信和抖音设备能力服务。 */
export class MiniGameDeviceService implements DeviceService {
  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  public getSystemInfo(): PlatformSystemInfo {
    const getSystemInfo = this.sdk.getSystemInfoSync;
    if (!getSystemInfo) throw featureUnavailable(this.platform, 'device.getSystemInfo');
    try {
      return this.normalizeSystemInfo(getSystemInfo.call(this.sdk));
    } catch (failure) {
      throw toPlatformError(this.platform, 'device.getSystemInfo', failure);
    }
  }

  public async getClipboardText(): Promise<string> {
    const getClipboardData = this.sdk.getClipboardData;
    if (!getClipboardData) throw featureUnavailable(this.platform, 'device.getClipboardText');
    const result = await invokeWithCallbacks<{ readonly data?: string }>(
      this.platform,
      'device.getClipboardText',
      (callbacks) => getClipboardData.call(this.sdk, callbacks),
    );
    return typeof result.data === 'string' ? result.data : '';
  }

  public async setClipboardText(text: string): Promise<void> {
    const setClipboardData = this.sdk.setClipboardData;
    if (!setClipboardData) throw featureUnavailable(this.platform, 'device.setClipboardText');
    await invokeWithCallbacks(
      this.platform,
      'device.setClipboardText',
      (callbacks) => setClipboardData.call(this.sdk, { ...callbacks, data: text }),
    );
  }

  public async vibrateShort(style: VibrationStyle = 'medium'): Promise<void> {
    const vibrateShort = this.sdk.vibrateShort;
    if (!vibrateShort) throw featureUnavailable(this.platform, 'device.vibrateShort');
    await invokeWithCallbacks(
      this.platform,
      'device.vibrateShort',
      (callbacks) => vibrateShort.call(this.sdk, { ...callbacks, type: style }),
    );
  }

  public async vibrateLong(): Promise<void> {
    const vibrateLong = this.sdk.vibrateLong;
    if (!vibrateLong) throw featureUnavailable(this.platform, 'device.vibrateLong');
    await invokeWithCallbacks(
      this.platform,
      'device.vibrateLong',
      (callbacks) => vibrateLong.call(this.sdk, callbacks),
    );
  }

  /** 将两个平台略有差异的系统信息和安全区字段归一化。 */
  private normalizeSystemInfo(info: MiniGameSystemInfo): PlatformSystemInfo {
    const screenWidth = this.finiteOr(info.screenWidth, info.windowWidth, 0);
    const screenHeight = this.finiteOr(info.screenHeight, info.windowHeight, 0);
    const windowWidth = this.finiteOr(info.windowWidth, info.screenWidth, 0);
    const windowHeight = this.finiteOr(info.windowHeight, info.screenHeight, 0);
    const screen = this.rect(0, 0, screenWidth, screenHeight);
    const windowRect = this.rect(0, 0, windowWidth, windowHeight);
    const safe = info.safeArea;
    const safeLeft = this.finiteOr(safe?.left, 0);
    const safeTop = this.finiteOr(safe?.top, 0);
    const safeWidth = this.finiteOr(
      safe?.width,
      this.difference(safe?.right, safe?.left),
      windowWidth,
    );
    const safeHeight = this.finiteOr(
      safe?.height,
      this.difference(safe?.bottom, safe?.top),
      windowHeight,
    );
    return {
      brand: info.brand ?? '',
      model: info.model ?? '',
      operatingSystem: this.normalizeOperatingSystem(info.platform, info.system),
      systemVersion: info.system ?? '',
      language: info.language ?? '',
      platformVersion: info.SDKVersion ?? info.version ?? '',
      pixelRatio: this.finiteOr(info.pixelRatio, 1),
      screen,
      window: windowRect,
      safeArea: this.rect(safeLeft, safeTop, safeWidth, safeHeight),
    };
  }

  private normalizeOperatingSystem(platform?: string, system?: string): OperatingSystem {
    const value = `${platform ?? ''} ${system ?? ''}`.toLowerCase();
    if (value.includes('android')) return 'android';
    if (value.includes('ios') || value.includes('iphone') || value.includes('ipad')) return 'ios';
    if (value.includes('windows')) return 'windows';
    if (value.includes('mac')) return 'macos';
    if (value.includes('linux')) return 'linux';
    return 'unknown';
  }

  private rect(left: number, top: number, width: number, height: number): PlatformRect {
    return { left, top, width: Math.max(0, width), height: Math.max(0, height) };
  }

  private difference(end?: number, start?: number): number | undefined {
    return Number.isFinite(end) && Number.isFinite(start) ? (end as number) - (start as number) : undefined;
  }

  private finiteOr(...values: readonly (number | undefined)[]): number {
    for (const value of values) {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return 0;
  }
}

/** 微信和抖音网络状态服务。 */
export class MiniGameNetworkService implements NetworkService {
  private readonly cancellations = new Set<Unsubscribe>();
  private destroyed = false;

  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  public async getStatus(): Promise<NetworkStatus> {
    this.assertAlive('network.getStatus');
    const getNetworkType = this.sdk.getNetworkType;
    if (!getNetworkType) throw featureUnavailable(this.platform, 'network.getStatus');
    const result = await invokeWithCallbacks<MiniGameNetworkTypeResult>(
      this.platform,
      'network.getStatus',
      (callbacks) => getNetworkType.call(this.sdk, callbacks),
    );
    return this.normalize(result);
  }

  public onChange(listener: (status: NetworkStatus) => void): Unsubscribe {
    this.assertAlive('network.onChange');
    const subscribe = this.sdk.onNetworkStatusChange;
    if (!subscribe) throw featureUnavailable(this.platform, 'network.onChange');
    let active = true;
    const wrapped = (result: MiniGameNetworkChangeResult): void => {
      if (active) listener(this.normalize(result));
    };
    subscribe.call(this.sdk, wrapped);
    const cancel = (): void => {
      if (!active) return;
      active = false;
      this.sdk.offNetworkStatusChange?.call(this.sdk, wrapped);
      this.cancellations.delete(cancel);
    };
    this.cancellations.add(cancel);
    return cancel;
  }

  public destroy(): void {
    if (this.destroyed) return;
    for (const cancel of Array.from(this.cancellations)) cancel();
    this.cancellations.clear();
    this.destroyed = true;
  }

  private normalize(result: MiniGameNetworkTypeResult & { readonly isConnected?: boolean }): NetworkStatus {
    const type = this.normalizeType(result.networkType);
    return {
      connected: result.isConnected ?? type !== 'none',
      type,
    };
  }

  private normalizeType(value?: string): NetworkType {
    const normalized = value?.toLowerCase();
    if (
      normalized === 'wifi'
      || normalized === '2g'
      || normalized === '3g'
      || normalized === '4g'
      || normalized === '5g'
      || normalized === 'ethernet'
      || normalized === 'none'
    ) return normalized;
    return 'unknown';
  }

  private assertAlive(operation: string): void {
    if (this.destroyed) {
      throw new PlatformError(this.platform, operation, 'The network service has been destroyed', 'SERVICE_DESTROYED');
    }
  }
}

/** 微信和抖音带启动参数的生命周期服务。 */
export class MiniGameLifecycleService implements PlatformLifecycleService {
  private readonly cancellations = new Set<Unsubscribe>();
  private destroyed = false;

  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  public getLaunchContext(): LaunchContext {
    this.assertAlive('lifecycle.getLaunchContext');
    const getLaunchOptions = this.sdk.getLaunchOptionsSync;
    if (!getLaunchOptions) throw featureUnavailable(this.platform, 'lifecycle.getLaunchContext');
    try {
      return this.normalizeContext(getLaunchOptions.call(this.sdk));
    } catch (failure) {
      throw toPlatformError(this.platform, 'lifecycle.getLaunchContext', failure);
    }
  }

  public onShow(listener: (context: LaunchContext) => void): Unsubscribe {
    this.assertAlive('lifecycle.onShow');
    const subscribe = this.sdk.onShow;
    if (!subscribe) throw featureUnavailable(this.platform, 'lifecycle.onShow');
    let active = true;
    const wrapped = (options: MiniGameLaunchOptions): void => {
      if (active) listener(this.normalizeContext(options));
    };
    subscribe.call(this.sdk, wrapped);
    return this.trackCancellation(() => {
      active = false;
      this.sdk.offShow?.call(this.sdk, wrapped);
    });
  }

  public onHide(listener: () => void): Unsubscribe {
    this.assertAlive('lifecycle.onHide');
    const subscribe = this.sdk.onHide;
    if (!subscribe) throw featureUnavailable(this.platform, 'lifecycle.onHide');
    let active = true;
    const wrapped = (): void => {
      if (active) listener();
    };
    subscribe.call(this.sdk, wrapped);
    return this.trackCancellation(() => {
      active = false;
      this.sdk.offHide?.call(this.sdk, wrapped);
    });
  }

  public destroy(): void {
    if (this.destroyed) return;
    for (const cancel of Array.from(this.cancellations)) cancel();
    this.cancellations.clear();
    this.destroyed = true;
  }

  /** 只保留跨平台稳定的启动字段，并过滤非字符串查询参数。 */
  private normalizeContext(options: MiniGameLaunchOptions): LaunchContext {
    const query: Record<string, string> = {};
    for (const key of Object.keys(options.query ?? {})) {
      const value = options.query?.[key];
      if (typeof value === 'string') query[key] = value;
      else if (typeof value === 'number' || typeof value === 'boolean') query[key] = String(value);
    }
    return {
      scene: typeof options.scene === 'number' && Number.isFinite(options.scene) ? options.scene : null,
      path: typeof options.path === 'string' ? options.path : '',
      query,
      referrerAppId: typeof options.referrerInfo?.appId === 'string'
        ? options.referrerInfo.appId
        : null,
      referrerExtraData: options.referrerInfo?.extraData ?? null,
    };
  }

  private trackCancellation(release: () => void): Unsubscribe {
    let subscribed = true;
    const cancel = (): void => {
      if (!subscribed) return;
      subscribed = false;
      release();
      this.cancellations.delete(cancel);
    };
    this.cancellations.add(cancel);
    return cancel;
  }

  private assertAlive(operation: string): void {
    if (this.destroyed) {
      throw new PlatformError(this.platform, operation, 'The lifecycle service has been destroyed', 'SERVICE_DESTROYED');
    }
  }
}

/** 微信和抖音客户端版本更新服务。 */
export class MiniGameUpdateService implements PlatformUpdateService {
  private readonly cancellations = new Set<Unsubscribe>();
  private manager: MiniGameUpdateManager | null = null;
  private managerResolved = false;
  private destroyed = false;

  public constructor(
    private readonly platform: MiniGameKind,
    private readonly sdk: MiniGameSdk,
  ) {}

  public onCheck(listener: (result: UpdateCheckResult) => void): Unsubscribe {
    const manager = this.getManager('updates.onCheck');
    let active = true;
    const wrapped = (result: MiniGameUpdateCheckResult): void => {
      if (active) listener({ hasUpdate: result.hasUpdate === true });
    };
    manager.onCheckForUpdate(wrapped);
    return this.trackCancellation(() => {
      active = false;
      manager.offCheckForUpdate?.(wrapped);
    });
  }

  public onReady(listener: () => void): Unsubscribe {
    const manager = this.getManager('updates.onReady');
    let active = true;
    const wrapped = (): void => {
      if (active) listener();
    };
    manager.onUpdateReady(wrapped);
    return this.trackCancellation(() => {
      active = false;
      manager.offUpdateReady?.(wrapped);
    });
  }

  public onFailed(listener: (error: PlatformError) => void): Unsubscribe {
    const manager = this.getManager('updates.onFailed');
    let active = true;
    const wrapped = (failure?: MiniGameSdkFailure): void => {
      if (active) listener(toPlatformError(this.platform, 'updates.download', failure));
    };
    manager.onUpdateFailed(wrapped);
    return this.trackCancellation(() => {
      active = false;
      manager.offUpdateFailed?.(wrapped);
    });
  }

  /** 应用已下载的新版本；原生平台通常会立即重启小游戏。 */
  public apply(): void {
    const manager = this.getManager('updates.apply');
    try {
      manager.applyUpdate();
    } catch (failure) {
      throw toPlatformError(this.platform, 'updates.apply', failure);
    }
  }

  public destroy(): void {
    if (this.destroyed) return;
    for (const cancel of Array.from(this.cancellations)) cancel();
    this.cancellations.clear();
    this.destroyed = true;
  }

  private getManager(operation: string): MiniGameUpdateManager {
    if (this.destroyed) {
      throw new PlatformError(this.platform, operation, 'The update service has been destroyed', 'SERVICE_DESTROYED');
    }
    if (this.managerResolved) {
      if (this.manager) return this.manager;
      throw featureUnavailable(this.platform, operation);
    }
    const create = this.sdk.getUpdateManager;
    if (!create) {
      this.managerResolved = true;
      throw featureUnavailable(this.platform, operation);
    }
    try {
      this.manager = create.call(this.sdk);
      this.managerResolved = true;
      return this.manager;
    } catch (failure) {
      throw toPlatformError(this.platform, operation, failure);
    }
  }

  private trackCancellation(release: () => void): Unsubscribe {
    let subscribed = true;
    const cancel = (): void => {
      if (!subscribed) return;
      subscribed = false;
      release();
      this.cancellations.delete(cancel);
    };
    this.cancellations.add(cancel);
    return cancel;
  }
}
