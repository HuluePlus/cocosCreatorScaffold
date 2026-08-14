/** framework ???????????????????????????? */
export { BaseEntity } from './base/BaseEntity';
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
  type GameLifecycleHooks,
  type LifecycleStateId,
} from './core/states/LifecycleStates';
export {
  CollisionUtils,
  type Circle2,
  type Point2,
  type Rect2,
} from './utils/CollisionUtils';
export { MathUtils } from './utils/MathUtils';
