import { describe, expect, it, vi } from 'vitest';
import { ByteDancePlatformService } from '../assets/framework/platform/ByteDancePlatform';
import type {
  MiniGameAdFailure,
  MiniGameBannerAd,
  MiniGameBannerResizeResult,
  MiniGameBannerStyle,
  MiniGameInterstitialAd,
  MiniGameLaunchOptions,
  MiniGameRewardedCloseResult,
  MiniGameRewardedVideoAd,
  MiniGameSdk,
  MiniGameSdkFailure,
  MiniGameUpdateCheckResult,
  MiniGameUpdateManager,
} from '../assets/framework/platform/MiniGameSdk';
import { createPlatformService } from '../assets/framework/platform/PlatformFactory';
import { PlatformError } from '../assets/framework/platform/PlatformTypes';
import { WeChatPlatformService } from '../assets/framework/platform/WeChatPlatform';

/** 可手动触发关闭和错误事件的激励视频测试替身。 */
class RewardedVideoStub implements MiniGameRewardedVideoAd {
  public loadCalls = 0;
  public showCalls = 0;
  public destroyCalls = 0;
  private readonly closeListeners = new Set<(result?: MiniGameRewardedCloseResult) => void>();
  private readonly errorListeners = new Set<(failure: MiniGameAdFailure) => void>();

  public async load(): Promise<void> {
    this.loadCalls += 1;
  }

  public async show(): Promise<void> {
    this.showCalls += 1;
  }

  public destroy(): void {
    this.destroyCalls += 1;
  }

  public onClose(listener: (result?: MiniGameRewardedCloseResult) => void): void {
    this.closeListeners.add(listener);
  }

  public offClose(listener: (result?: MiniGameRewardedCloseResult) => void): void {
    this.closeListeners.delete(listener);
  }

  public onError(listener: (failure: MiniGameAdFailure) => void): void {
    this.errorListeners.add(listener);
  }

  public offError(listener: (failure: MiniGameAdFailure) => void): void {
    this.errorListeners.delete(listener);
  }

  /** 模拟用户关闭广告。 */
  public close(result?: MiniGameRewardedCloseResult): void {
    for (const listener of Array.from(this.closeListeners)) listener(result);
  }

  /** 模拟原生广告错误。 */
  public fail(failure: MiniGameAdFailure): void {
    for (const listener of Array.from(this.errorListeners)) listener(failure);
  }

  public get listenerCount(): number {
    return this.closeListeners.size + this.errorListeners.size;
  }
}

/** 插屏广告测试替身。 */
class InterstitialStub implements MiniGameInterstitialAd {
  public loadCalls = 0;
  public showCalls = 0;
  public destroyCalls = 0;
  private readonly errorListeners = new Set<(failure: MiniGameAdFailure) => void>();

  public async load(): Promise<void> {
    this.loadCalls += 1;
  }

  public async show(): Promise<void> {
    this.showCalls += 1;
  }

  public destroy(): void {
    this.destroyCalls += 1;
  }

  public onError(listener: (failure: MiniGameAdFailure) => void): void {
    this.errorListeners.add(listener);
  }

  public offError(listener: (failure: MiniGameAdFailure) => void): void {
    this.errorListeners.delete(listener);
  }
}

/** Banner 广告测试替身。 */
class BannerStub implements MiniGameBannerAd {
  public showCalls = 0;
  public hideCalls = 0;
  public destroyCalls = 0;
  private readonly resizeListeners = new Set<(result: MiniGameBannerResizeResult) => void>();
  private readonly errorListeners = new Set<(failure: MiniGameAdFailure) => void>();

  public constructor(public readonly style: MiniGameBannerStyle) {}

  public async show(): Promise<void> {
    this.showCalls += 1;
  }

  public async hide(): Promise<void> {
    this.hideCalls += 1;
  }

  public destroy(): void {
    this.destroyCalls += 1;
  }

  public onResize(listener: (result: MiniGameBannerResizeResult) => void): void {
    this.resizeListeners.add(listener);
  }

  public offResize(listener: (result: MiniGameBannerResizeResult) => void): void {
    this.resizeListeners.delete(listener);
  }

  public onError(listener: (failure: MiniGameAdFailure) => void): void {
    this.errorListeners.add(listener);
  }

  public offError(listener: (failure: MiniGameAdFailure) => void): void {
    this.errorListeners.delete(listener);
  }

  /** 模拟原生 Banner 尺寸变化。 */
  public resize(width: number, height: number): void {
    for (const listener of Array.from(this.resizeListeners)) listener({ width, height });
  }
}

/** 客户端更新管理器测试替身。 */
class UpdateManagerStub implements MiniGameUpdateManager {
  public applyCalls = 0;
  private readonly checkListeners = new Set<(result: MiniGameUpdateCheckResult) => void>();
  private readonly readyListeners = new Set<() => void>();
  private readonly failedListeners = new Set<(failure?: MiniGameSdkFailure) => void>();

  public onCheckForUpdate(listener: (result: MiniGameUpdateCheckResult) => void): void {
    this.checkListeners.add(listener);
  }

  public offCheckForUpdate(listener: (result: MiniGameUpdateCheckResult) => void): void {
    this.checkListeners.delete(listener);
  }

  public onUpdateReady(listener: () => void): void {
    this.readyListeners.add(listener);
  }

  public offUpdateReady(listener: () => void): void {
    this.readyListeners.delete(listener);
  }

  public onUpdateFailed(listener: (failure?: MiniGameSdkFailure) => void): void {
    this.failedListeners.add(listener);
  }

  public offUpdateFailed(listener: (failure?: MiniGameSdkFailure) => void): void {
    this.failedListeners.delete(listener);
  }

  public applyUpdate(): void {
    this.applyCalls += 1;
  }

  /** 依次触发检查、就绪和失败事件。 */
  public emitAll(): void {
    for (const listener of Array.from(this.checkListeners)) listener({ hasUpdate: true });
    for (const listener of Array.from(this.readyListeners)) listener();
    for (const listener of Array.from(this.failedListeners)) listener({ errCode: 2001, errMsg: 'download failed' });
  }

  public get listenerCount(): number {
    return this.checkListeners.size + this.readyListeners.size + this.failedListeners.size;
  }
}

describe('platform factory', () => {
  it('detects WeChat and ByteDance globals before falling back to web', () => {
    const marker: MiniGameSdk = { getSystemInfoSync: () => ({}) };
    const wechat = createPlatformService({ globals: { wx: marker, tt: marker } });
    const bytedance = createPlatformService({ globals: { tt: marker } });
    const web = createPlatformService({ globals: { wx: {}, tt: 'not-sdk' } });

    expect(wechat.kind).toBe('wechat');
    expect(bytedance.kind).toBe('bytedance');
    expect(web.kind).toBe('web');

    wechat.destroy();
    bytedance.destroy();
    web.destroy();
  });
});

describe('mini-game advertising', () => {
  it('normalizes WeChat rewarded close results and releases native listeners', async () => {
    const nativeAd = new RewardedVideoStub();
    const sdk: MiniGameSdk = { createRewardedVideoAd: () => nativeAd };
    const platform = new WeChatPlatformService(sdk);
    const ad = platform.ads.createRewardedVideo({ adUnitId: 'reward-main' });
    const resultPromise = ad.show();

    await vi.waitFor(() => expect(nativeAd.showCalls).toBe(1));
    nativeAd.close({ isEnded: true });

    await expect(resultPromise).resolves.toEqual({ completed: true, watchedCount: 1 });
    expect(platform.ads.createRewardedVideo({ adUnitId: 'reward-main' })).toBe(ad);

    platform.destroy();
    expect(nativeAd.destroyCalls).toBe(1);
    expect(nativeAd.listenerCount).toBe(0);
  });

  it('preserves ByteDance multi-watch count and rejects concurrent shows', async () => {
    const nativeAd = new RewardedVideoStub();
    const platform = new ByteDancePlatformService({ createRewardedVideoAd: () => nativeAd });
    const ad = platform.ads.createRewardedVideo({ adUnitId: 'reward-multi' });
    const first = ad.show();

    await expect(ad.show()).rejects.toMatchObject({ code: 'AD_BUSY' });
    await vi.waitFor(() => expect(nativeAd.showCalls).toBe(1));
    nativeAd.close({ count: 3 });

    await expect(first).resolves.toEqual({ completed: true, watchedCount: 3 });
    platform.destroy();
  });

  it('wraps ad errors and manages interstitial and Banner handles', async () => {
    const rewarded = new RewardedVideoStub();
    const interstitial = new InterstitialStub();
    const banner = new BannerStub({ left: 0, top: 0, width: 300 });
    const platform = new WeChatPlatformService({
      createRewardedVideoAd: () => rewarded,
      createInterstitialAd: () => interstitial,
      createBannerAd: () => banner,
    });
    const errorCodes: (string | number | null)[] = [];
    const rewardedHandle = platform.ads.createRewardedVideo({ adUnitId: 'reward-error' });
    rewardedHandle.onError((error) => errorCodes.push(error.code));
    const resultPromise = rewardedHandle.show();
    await vi.waitFor(() => expect(rewarded.showCalls).toBe(1));
    rewarded.fail({ errCode: 1004, errMsg: 'no inventory' });
    await expect(resultPromise).rejects.toMatchObject({ code: 1004 });
    expect(errorCodes).toEqual([1004]);

    const interstitialHandle = platform.ads.createInterstitial({ adUnitId: 'interstitial-main' });
    await interstitialHandle.show();
    expect([interstitial.loadCalls, interstitial.showCalls]).toEqual([1, 1]);

    const bannerHandle = platform.ads.createBanner({
      adUnitId: 'banner-main',
      style: { left: 10, top: 20, width: 320 },
    });
    const sizes: string[] = [];
    bannerHandle.onResize(({ width, height }) => sizes.push(`${width}x${height}`));
    bannerHandle.updateStyle({ left: 12, top: 24, width: 300, height: 80 });
    banner.resize(300, 80);
    await bannerHandle.show();
    await bannerHandle.hide();
    expect(banner.style).toEqual({ left: 12, top: 24, width: 300, height: 80 });
    expect(sizes).toEqual(['300x80']);

    platform.destroy();
    expect([interstitial.destroyCalls, banner.destroyCalls]).toEqual([1, 1]);
  });
});

describe('mini-game common services', () => {
  it('normalizes client update events and removes update listeners', () => {
    const manager = new UpdateManagerStub();
    const platform = new ByteDancePlatformService({ getUpdateManager: () => manager });
    const events: string[] = [];

    platform.updates.onCheck(({ hasUpdate }) => events.push(`check:${hasUpdate}`));
    platform.updates.onReady(() => events.push('ready'));
    platform.updates.onFailed((error) => events.push(`failed:${error.code}`));
    manager.emitAll();
    platform.updates.apply();

    expect(events).toEqual(['check:true', 'ready', 'failed:2001']);
    expect(manager.applyCalls).toBe(1);
    platform.destroy();
    expect(manager.listenerCount).toBe(0);
    manager.emitAll();
    expect(events).toEqual(['check:true', 'ready', 'failed:2001']);
  });

  it('normalizes login, storage, device, network, and lifecycle data', async () => {
    const values = new Map<string, unknown>();
    const listeners: {
      network: ((result: { readonly isConnected?: boolean; readonly networkType?: string }) => void) | null;
      show: ((options: MiniGameLaunchOptions) => void) | null;
      hide: (() => void) | null;
    } = { network: null, show: null, hide: null };
    const sdk: MiniGameSdk = {
      login: (options) => options.success?.({ code: 'login-code', anonymousCode: 'anon', isLogin: true }),
      getStorage: (options) => {
        if (values.has(options.key)) options.success?.({ data: values.get(options.key) });
        else options.fail?.({ errMsg: 'data not found' });
      },
      setStorage: (options) => {
        values.set(options.key, options.data);
        options.success?.();
      },
      removeStorage: (options) => {
        values.delete(options.key);
        options.success?.();
      },
      clearStorage: (options) => {
        values.clear();
        options.success?.();
      },
      getSystemInfoSync: () => ({
        brand: 'Brand',
        model: 'Model',
        platform: 'ios',
        system: 'iOS 18',
        SDKVersion: '3.7.7',
        pixelRatio: 3,
        screenWidth: 390,
        screenHeight: 844,
        windowWidth: 390,
        windowHeight: 820,
        safeArea: { left: 0, top: 44, right: 390, bottom: 810 },
      }),
      getNetworkType: (options) => options.success?.({ networkType: 'wifi' }),
      onNetworkStatusChange: (listener) => {
        listeners.network = listener;
      },
      offNetworkStatusChange: () => {
        listeners.network = null;
      },
      getLaunchOptionsSync: () => ({
        scene: 1001,
        path: '/pages/game',
        query: { room: '42', ignored: { nested: true } },
        referrerInfo: { appId: 'source-app', extraData: { campaign: 'summer' } },
      }),
      onShow: (listener) => {
        listeners.show = listener;
      },
      offShow: () => {
        listeners.show = null;
      },
      onHide: (listener) => {
        listeners.hide = listener;
      },
      offHide: () => {
        listeners.hide = null;
      },
    };
    const platform = new WeChatPlatformService(sdk);

    await expect(platform.account.login()).resolves.toEqual({
      code: 'login-code',
      anonymousCode: 'anon',
      alreadyLoggedIn: true,
    });
    expect(await platform.storage.get('missing')).toBeNull();
    await platform.storage.set('settings', { music: true, volume: 0.8 });
    await expect(platform.storage.get('settings')).resolves.toEqual({ music: true, volume: 0.8 });

    const info = platform.device.getSystemInfo();
    expect(info.operatingSystem).toBe('ios');
    expect(info.safeArea).toEqual({ left: 0, top: 44, width: 390, height: 766 });
    await expect(platform.network.getStatus()).resolves.toEqual({ connected: true, type: 'wifi' });

    const statuses: string[] = [];
    const contexts: string[] = [];
    const unsubscribeNetwork = platform.network.onChange((status) => statuses.push(`${status.connected}:${status.type}`));
    platform.lifecycle.onShow((context) => contexts.push(context.query.room ?? 'none'));
    platform.lifecycle.onHide(() => contexts.push('hidden'));
    expect(platform.lifecycle.getLaunchContext()).toMatchObject({
      scene: 1001,
      path: '/pages/game',
      query: { room: '42' },
      referrerAppId: 'source-app',
    });

    listeners.network?.({ isConnected: false, networkType: 'none' });
    listeners.show?.({ query: { room: '84' } });
    listeners.hide?.();
    expect(statuses).toEqual(['false:none']);
    expect(contexts).toEqual(['84', 'hidden']);

    unsubscribeNetwork();
    platform.destroy();
    expect(listeners.network).toBeNull();
    expect(listeners.show).toBeNull();
    expect(listeners.hide).toBeNull();
  });

  it('uses explicit capability errors in Web preview', async () => {
    const platform = createPlatformService({ globals: {} });
    expect(platform.capabilities.ads.rewardedVideo).toBe(false);
    expect(() => platform.ads.createRewardedVideo({ adUnitId: 'preview' }))
      .toThrowError(PlatformError);

    await platform.storage.set('preview', { enabled: true });
    await expect(platform.storage.get('preview')).resolves.toEqual({ enabled: true });
    platform.destroy();
  });
});
