import type { Unsubscribe } from '../core/EventBus';
import { UnavailableAdvertisingService } from './Advertising';
import { featureUnavailable, toPlatformError } from './PlatformErrors';
import {
  PlatformError,
  type AccountService,
  type DeviceService,
  type LaunchContext,
  type LoginResult,
  type NetworkService,
  type NetworkStatus,
  type OperatingSystem,
  type PlatformCapabilities,
  type PlatformLifecycleService,
  type PlatformService,
  type PlatformSystemInfo,
  type PlatformUpdateService,
  type ShareMenuOptions,
  type ShareMessage,
  type ShareService,
  type StorageService,
  type StorageValue,
  type VibrationStyle,
  type UpdateCheckResult,
} from './PlatformTypes';

/** 判断反序列化结果是否属于平台缓存支持的数据范围。 */
function isStorageValue(value: unknown, visiting = new Set<object>()): value is StorageValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || visiting.has(value)) return false;
  visiting.add(value);
  const values = Array.isArray(value)
    ? value
    : Object.keys(value).map((key) => (value as Readonly<Record<string, unknown>>)[key]);
  const valid = values.every((entry) => isStorageValue(entry, visiting));
  visiting.delete(value);
  return valid;
}

/** Node 单测或受限 WebView 中 localStorage 不可用时的内存后备。 */
class WebStorageService implements StorageService {
  private readonly memory = new Map<string, StorageValue>();

  public async get(key: string): Promise<StorageValue | null> {
    this.assertKey(key);
    const storage = this.getNativeStorage();
    if (!storage) return this.memory.get(key) ?? null;
    try {
      const serialized = storage.getItem(key);
      if (serialized === null) return null;
      const value: unknown = JSON.parse(serialized);
      if (!isStorageValue(value)) {
        throw new PlatformError('web', 'storage.get', 'The stored value is not serializable', 'INVALID_STORED_VALUE');
      }
      return value;
    } catch (failure) {
      throw toPlatformError('web', 'storage.get', failure);
    }
  }

  public async set(key: string, value: StorageValue): Promise<void> {
    this.assertKey(key);
    if (!isStorageValue(value)) {
      throw new PlatformError('web', 'storage.set', 'The storage value must be finite and serializable', 'INVALID_ARGUMENT');
    }
    const storage = this.getNativeStorage();
    if (!storage) {
      this.memory.set(key, value);
      return;
    }
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (failure) {
      throw toPlatformError('web', 'storage.set', failure);
    }
  }

  public async remove(key: string): Promise<void> {
    this.assertKey(key);
    const storage = this.getNativeStorage();
    if (!storage) {
      this.memory.delete(key);
      return;
    }
    try {
      storage.removeItem(key);
    } catch (failure) {
      throw toPlatformError('web', 'storage.remove', failure);
    }
  }

  public async clear(): Promise<void> {
    const storage = this.getNativeStorage();
    if (!storage) {
      this.memory.clear();
      return;
    }
    try {
      storage.clear();
    } catch (failure) {
      throw toPlatformError('web', 'storage.clear', failure);
    }
  }

  private getNativeStorage(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  private assertKey(key: string): void {
    if (key.trim().length === 0) {
      throw new PlatformError('web', 'storage', 'Storage key must not be empty', 'INVALID_ARGUMENT');
    }
  }
}

/** Web 预览的账号降级实现。 */
class WebAccountService implements AccountService {
  public login(): Promise<LoginResult> {
    return Promise.reject(featureUnavailable('web', 'account.login'));
  }
}

/** 使用 Web Share API 的预览实现。 */
class WebShareService implements ShareService {
  public async share(message: ShareMessage): Promise<void> {
    if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
      throw featureUnavailable('web', 'share.message');
    }
    try {
      const url = this.createShareUrl(message.query);
      await navigator.share({ title: message.title, url });
    } catch (failure) {
      throw toPlatformError('web', 'share.message', failure);
    }
  }

  public showMenu(_options: ShareMenuOptions = {}): Promise<void> {
    return Promise.reject(featureUnavailable('web', 'share.showMenu'));
  }

  private createShareUrl(query?: string): string | undefined {
    if (typeof location === 'undefined') return undefined;
    if (!query) return location.href;
    const separator = location.href.includes('?') ? '&' : '?';
    return `${location.href}${separator}${query}`;
  }
}

/** Web 预览的设备信息、剪贴板和震动实现。 */
class WebDeviceService implements DeviceService {
  public getSystemInfo(): PlatformSystemInfo {
    const width = typeof window === 'undefined' ? 0 : window.innerWidth;
    const height = typeof window === 'undefined' ? 0 : window.innerHeight;
    const screenWidth = typeof screen === 'undefined' ? width : screen.width;
    const screenHeight = typeof screen === 'undefined' ? height : screen.height;
    const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
    const windowRect = { left: 0, top: 0, width, height };
    return {
      brand: '',
      model: '',
      operatingSystem: this.normalizeOperatingSystem(userAgent),
      systemVersion: userAgent,
      language: typeof navigator === 'undefined' ? '' : navigator.language,
      platformVersion: '',
      pixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      screen: { left: 0, top: 0, width: screenWidth, height: screenHeight },
      window: windowRect,
      safeArea: windowRect,
    };
  }

  public async getClipboardText(): Promise<string> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      throw featureUnavailable('web', 'device.getClipboardText');
    }
    try {
      return await navigator.clipboard.readText();
    } catch (failure) {
      throw toPlatformError('web', 'device.getClipboardText', failure);
    }
  }

  public async setClipboardText(text: string): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      throw featureUnavailable('web', 'device.setClipboardText');
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (failure) {
      throw toPlatformError('web', 'device.setClipboardText', failure);
    }
  }

  public async vibrateShort(style: VibrationStyle = 'medium'): Promise<void> {
    const durations: Readonly<Record<VibrationStyle, number>> = {
      light: 20,
      medium: 40,
      heavy: 70,
    };
    this.vibrate(durations[style], 'device.vibrateShort');
  }

  public async vibrateLong(): Promise<void> {
    this.vibrate(400, 'device.vibrateLong');
  }

  private vibrate(duration: number, operation: string): void {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      throw featureUnavailable('web', operation);
    }
    navigator.vibrate(duration);
  }

  private normalizeOperatingSystem(userAgent: string): OperatingSystem {
    const value = userAgent.toLowerCase();
    if (value.includes('android')) return 'android';
    if (value.includes('iphone') || value.includes('ipad') || value.includes('ios')) return 'ios';
    if (value.includes('windows')) return 'windows';
    if (value.includes('mac')) return 'macos';
    if (value.includes('linux')) return 'linux';
    return 'unknown';
  }
}

/** Web 在线状态实现。 */
class WebNetworkService implements NetworkService {
  private readonly cancellations = new Set<Unsubscribe>();
  private destroyed = false;

  public async getStatus(): Promise<NetworkStatus> {
    this.assertAlive('network.getStatus');
    const connected = typeof navigator === 'undefined' ? true : navigator.onLine;
    return { connected, type: connected ? 'unknown' : 'none' };
  }

  public onChange(listener: (status: NetworkStatus) => void): Unsubscribe {
    this.assertAlive('network.onChange');
    if (typeof window === 'undefined') throw featureUnavailable('web', 'network.onChange');
    let active = true;
    const online = (): void => {
      if (active) listener({ connected: true, type: 'unknown' });
    };
    const offline = (): void => {
      if (active) listener({ connected: false, type: 'none' });
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const cancel = (): void => {
      if (!active) return;
      active = false;
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
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

  private assertAlive(operation: string): void {
    if (this.destroyed) {
      throw new PlatformError('web', operation, 'The network service has been destroyed', 'SERVICE_DESTROYED');
    }
  }
}

/** Web 预览通过页面可见性提供与小游戏相同的订阅形状。 */
class WebLifecycleService implements PlatformLifecycleService {
  private readonly cancellations = new Set<Unsubscribe>();
  private destroyed = false;

  public getLaunchContext(): LaunchContext {
    this.assertAlive('lifecycle.getLaunchContext');
    const query: Record<string, string> = {};
    if (typeof location !== 'undefined') {
      const params = new URLSearchParams(location.search);
      params.forEach((value, key) => {
        query[key] = value;
      });
    }
    return {
      scene: null,
      path: typeof location === 'undefined' ? '' : location.pathname,
      query,
      referrerAppId: null,
      referrerExtraData: null,
    };
  }

  public onShow(listener: (context: LaunchContext) => void): Unsubscribe {
    return this.subscribeVisibility('visible', () => listener(this.getLaunchContext()), 'lifecycle.onShow');
  }

  public onHide(listener: () => void): Unsubscribe {
    return this.subscribeVisibility('hidden', listener, 'lifecycle.onHide');
  }

  public destroy(): void {
    if (this.destroyed) return;
    for (const cancel of Array.from(this.cancellations)) cancel();
    this.cancellations.clear();
    this.destroyed = true;
  }

  private subscribeVisibility(
    expected: DocumentVisibilityState,
    listener: () => void,
    operation: string,
  ): Unsubscribe {
    this.assertAlive(operation);
    if (typeof document === 'undefined') throw featureUnavailable('web', operation);
    let active = true;
    const wrapped = (): void => {
      if (active && document.visibilityState === expected) listener();
    };
    document.addEventListener('visibilitychange', wrapped);
    const cancel = (): void => {
      if (!active) return;
      active = false;
      document.removeEventListener('visibilitychange', wrapped);
      this.cancellations.delete(cancel);
    };
    this.cancellations.add(cancel);
    return cancel;
  }

  private assertAlive(operation: string): void {
    if (this.destroyed) {
      throw new PlatformError('web', operation, 'The lifecycle service has been destroyed', 'SERVICE_DESTROYED');
    }
  }
}

/** Web 预览没有小游戏版本更新管理器。 */
class WebUpdateService implements PlatformUpdateService {
  public onCheck(_listener: (result: UpdateCheckResult) => void): Unsubscribe {
    throw featureUnavailable('web', 'updates.onCheck');
  }

  public onReady(_listener: () => void): Unsubscribe {
    throw featureUnavailable('web', 'updates.onReady');
  }

  public onFailed(_listener: (error: PlatformError) => void): Unsubscribe {
    throw featureUnavailable('web', 'updates.onFailed');
  }

  public apply(): void {
    throw featureUnavailable('web', 'updates.apply');
  }

  public destroy(): void {}
}

/** 浏览器预览实现，广告和登录会明确报告能力不可用。 */
export class WebPlatformService implements PlatformService {
  public readonly kind = 'web' as const;
  public readonly capabilities: PlatformCapabilities;
  public readonly ads = new UnavailableAdvertisingService('web');
  public readonly account = new WebAccountService();
  public readonly share = new WebShareService();
  public readonly storage = new WebStorageService();
  public readonly device = new WebDeviceService();
  public readonly network = new WebNetworkService();
  public readonly lifecycle = new WebLifecycleService();
  public readonly updates = new WebUpdateService();
  private destroyed = false;

  public constructor() {
    this.capabilities = {
      ads: { rewardedVideo: false, interstitial: false, banner: false },
      login: false,
      shareMessage: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
      shareMenu: false,
      timelineShare: false,
      storage: true,
      clipboard: typeof navigator !== 'undefined' && Boolean(navigator.clipboard),
      vibration: typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function',
      networkStatus: typeof navigator !== 'undefined',
      lifecycleContext: typeof location !== 'undefined',
      updates: false,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.ads.destroy();
    this.network.destroy();
    this.lifecycle.destroy();
    this.updates.destroy();
    this.destroyed = true;
  }
}
