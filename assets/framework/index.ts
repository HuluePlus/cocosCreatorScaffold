/** framework 对外入口，业务层只从这里选择需要的通用能力。 */
export { BaseEntity } from './base/BaseEntity';
export {
  AudioManager,
  type AudioEffectHandle,
  type AudioManagerOptions,
  type AudioOverflowPolicy,
  type EffectPlaybackOptions,
  type MusicPlaybackOptions,
} from './audio/AudioManager';
export { EventBus, type Unsubscribe } from './core/EventBus';
export { GameManager } from './core/GameManager';
export {
  ObjectPool,
  PoolManager,
  type Poolable,
  type PoolFactory,
  type PoolOptions,
} from './core/PoolManager';
export { StateMachine, type State } from './core/StateMachine';
export {
  ShakeModel,
  type ShakeImpulseOptions,
  type ShakeSample,
} from './core/ShakeModel';
export {
  type GameLifecycleHooks,
  type LifecycleStateId,
} from './core/states/LifecycleStates';
export { CameraShake } from './effects/CameraShake';
export {
  CollisionUtils,
  type Circle2,
  type Point2,
  type Rect2,
} from './utils/CollisionUtils';
export { MathUtils } from './utils/MathUtils';
export {
  MiniGameAdvertisingService,
  UnavailableAdvertisingService,
} from './platform/Advertising';
export { ByteDancePlatformService } from './platform/ByteDancePlatform';
export {
  createPlatformService,
  type CreatePlatformServiceOptions,
  type PlatformGlobalScope,
} from './platform/PlatformFactory';
export {
  PlatformError,
  type AccountService,
  type AdvertisingService,
  type BannerAd,
  type BannerAdOptions,
  type BannerAdSize,
  type BannerAdStyle,
  type DeviceService,
  type InterstitialAd,
  type InterstitialAdOptions,
  type LaunchContext,
  type LoginResult,
  type NetworkService,
  type NetworkStatus,
  type NetworkType,
  type OperatingSystem,
  type PlatformCapabilities,
  type PlatformKind,
  type PlatformLifecycleService,
  type PlatformRect,
  type PlatformService,
  type PlatformSystemInfo,
  type PlatformUpdateService,
  type RewardedVideoAd,
  type RewardedVideoAdOptions,
  type RewardedVideoResult,
  type ShareChannel,
  type ShareMenuOptions,
  type ShareMessage,
  type ShareService,
  type StorageService,
  type StorageValue,
  type UpdateCheckResult,
  type VibrationStyle,
} from './platform/PlatformTypes';
export { WebPlatformService } from './platform/WebPlatform';
export { WeChatPlatformService } from './platform/WeChatPlatform';
export type { MiniGameSdk } from './platform/MiniGameSdk';
