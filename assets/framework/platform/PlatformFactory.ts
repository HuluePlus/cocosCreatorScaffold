import { ByteDancePlatformService } from './ByteDancePlatform';
import type { MiniGameSdk } from './MiniGameSdk';
import type { PlatformService } from './PlatformTypes';
import { WebPlatformService } from './WebPlatform';
import { WeChatPlatformService } from './WeChatPlatform';

/** 可注入的全局对象，单元测试和平台调试工具无需修改真实 globalThis。 */
export interface PlatformGlobalScope {
  readonly wx?: unknown;
  readonly tt?: unknown;
}

/** 平台服务工厂参数。 */
export interface CreatePlatformServiceOptions {
  readonly globals?: PlatformGlobalScope;
}

/** 判断未知全局对象是否至少暴露一个小游戏平台标志性方法。 */
function isMiniGameSdk(value: unknown): value is MiniGameSdk {
  if (typeof value !== 'object' || value === null) return false;
  const sdk = value as Readonly<Record<string, unknown>>;
  return typeof sdk.getSystemInfoSync === 'function'
    || typeof sdk.getLaunchOptionsSync === 'function'
    || typeof sdk.createRewardedVideoAd === 'function'
    || typeof sdk.login === 'function';
}

/** 读取运行时全局对象而不声明 wx/tt 全局变量。 */
function runtimeGlobals(): PlatformGlobalScope {
  return globalThis as typeof globalThis & PlatformGlobalScope;
}

/**
 * 按微信、抖音、Web 的顺序创建平台服务。
 * 显式注入 globals 时仍执行签名校验，避免把同名业务变量误判为平台 SDK。
 */
export function createPlatformService(
  options: CreatePlatformServiceOptions = {},
): PlatformService {
  const globals = options.globals ?? runtimeGlobals();
  if (isMiniGameSdk(globals.wx)) return new WeChatPlatformService(globals.wx);
  if (isMiniGameSdk(globals.tt)) return new ByteDancePlatformService(globals.tt);
  return new WebPlatformService();
}
