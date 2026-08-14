/** framework ???????????????????????????? */
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
