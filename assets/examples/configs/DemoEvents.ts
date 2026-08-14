import type { DemoRunState } from '../core/DemoStateMachine';

/** 示例中跨模块传递的事件与载荷。 */
export interface DemoEventMap {
  readonly 'demo:state-changed': {
    readonly state: DemoRunState;
  };
  readonly 'demo:population-changed': {
    readonly active: number;
    readonly pooled: number;
    readonly created: number;
  };
  readonly 'demo:collision': {
    readonly total: number;
  };
}
