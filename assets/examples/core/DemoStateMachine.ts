import { StateMachine, type State } from '../../framework/core/StateMachine';

/** 示例运行状态。 */
export type DemoRunState = 'ready' | 'running' | 'paused';

interface DemoStateContext {
  readonly onStateChanged: (state: DemoRunState) => void;
}

/** 示例状态基类，只负责把明确的状态变化通知给业务控制器。 */
abstract class DemoState implements State<DemoStateContext, DemoRunState> {
  public abstract readonly id: DemoRunState;

  /** 进入状态时发布一次状态变化。 */
  public enter(context: DemoStateContext, _previous: DemoRunState | null): void {
    context.onStateChanged(this.id);
  }

  /** 示例没有离开状态时的额外副作用。 */
  public exit(_context: DemoStateContext, _next: DemoRunState): void {}
}

/** 等待开始的初始状态。 */
class ReadyState extends DemoState {
  public readonly id = 'ready' as const;
}

/** 实体持续运动和碰撞检测的运行状态。 */
class RunningState extends DemoState {
  public readonly id = 'running' as const;
}

/** 保留当前实体但停止更新的暂停状态。 */
class PausedState extends DemoState {
  public readonly id = 'paused' as const;
}

/**
 * 示例状态控制器，演示业务层如何组合通用 StateMachine。
 * UI 只调用 start/pause/resume，不直接修改状态字符串。
 */
export class DemoStateMachine {
  private readonly machine: StateMachine<DemoStateContext, DemoRunState>;

  public constructor(onStateChanged: (state: DemoRunState) => void) {
    this.machine = new StateMachine({ onStateChanged });
    this.machine
      .register(new ReadyState())
      .register(new RunningState())
      .register(new PausedState());
    this.machine.start('ready');
  }

  /** 返回当前运行状态。 */
  public get current(): DemoRunState {
    return this.machine.current ?? 'ready';
  }

  /** 从初始或暂停状态进入运行状态。 */
  public start(): void {
    if (this.current !== 'running') this.machine.transitionTo('running');
  }

  /** 仅在运行中进入暂停状态。 */
  public pause(): void {
    if (this.current === 'running') this.machine.transitionTo('paused');
  }

  /** 仅从暂停状态恢复运行。 */
  public resume(): void {
    if (this.current === 'paused') this.machine.transitionTo('running');
  }

  /** 在运行与暂停之间切换。 */
  public toggle(): void {
    if (this.current === 'running') this.pause();
    else this.start();
  }
}
