import { StateMachine } from './StateMachine';
import {
  DestroyedState,
  IdleState,
  PausedState,
  RunningState,
  type GameLifecycleHooks,
  type LifecycleStateId,
} from './states/LifecycleStates';

/**
 * ????????????
 * ?????????????????????????UI ??????
 */
export class GameManager {
  private static readonly singleton = new GameManager();
  private stateMachine: StateMachine<GameLifecycleHooks, LifecycleStateId> | null = null;

  private constructor() {}

  /** ??????????????? */
  public static get instance(): GameManager {
    return GameManager.singleton;
  }

  /** ????????????????? null? */
  public get state(): LifecycleStateId | null {
    return this.stateMachine?.current ?? null;
  }

  /**
   * ???????????????
   * @param hooks ????????????????
   */
  public configure(hooks: GameLifecycleHooks): void {
    if (this.stateMachine && this.stateMachine.current !== 'destroyed') {
      throw new Error('GameManager must be destroyed before reconfiguration');
    }
    const machine = new StateMachine<GameLifecycleHooks, LifecycleStateId>(hooks);
    machine
      .register(new IdleState())
      .register(new RunningState())
      .register(new PausedState())
      .register(new DestroyedState());
    machine.start('idle');
    this.stateMachine = machine;
  }

  /** ?????????????? */
  public start(): void {
    if (this.stateMachine?.current === 'idle') this.stateMachine.transitionTo('running');
  }

  /** ?????????????? */
  public pause(): void {
    if (this.stateMachine?.current === 'running') this.stateMachine.transitionTo('paused');
  }

  /** ?????????????? */
  public resume(): void {
    if (this.stateMachine?.current === 'paused') this.stateMachine.transitionTo('running');
  }

  /**
   * ???????
   * @param deltaTime ?????????
   */
  public update(deltaTime: number): void {
    if (this.stateMachine?.current === 'running') this.stateMachine.update(deltaTime);
  }

  /** ?????????????????? */
  public destroy(): void {
    const machine = this.stateMachine;
    const current = machine?.current;
    if (!current || current === 'destroyed') return;
    try {
      machine.transitionTo('destroyed');
    } finally {
      // ??????????????????????????????????
      this.stateMachine = null;
    }
  }
}
