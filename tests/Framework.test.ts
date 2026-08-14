import { describe, expect, it } from 'vitest';
import { EventBus } from '../assets/framework/core/EventBus';
import { GameManager } from '../assets/framework/core/GameManager';
import { PoolManager, type Poolable } from '../assets/framework/core/PoolManager';
import { StateMachine, type State } from '../assets/framework/core/StateMachine';
import { CollisionUtils } from '../assets/framework/utils/CollisionUtils';
import { MathUtils } from '../assets/framework/utils/MathUtils';
import { DemoStateMachine } from '../assets/examples/core/DemoStateMachine';

/** 测试事件表，用于验证事件载荷的静态类型和退订行为。 */
interface TestEvents {
  readonly score: { readonly value: number };
}

/** 状态机测试上下文。 */
interface TestContext {
  readonly calls: string[];
}

/** 记录进入与退出顺序的测试状态。 */
class RecordingState implements State<TestContext, 'idle' | 'active'> {
  public constructor(public readonly id: 'idle' | 'active') {}

  /** 记录进入状态。 */
  public enter(context: TestContext, previous: 'idle' | 'active' | null): void {
    context.calls.push(`enter:${this.id}:${previous ?? 'none'}`);
  }

  /** 记录退出状态。 */
  public exit(context: TestContext, next: 'idle' | 'active'): void {
    context.calls.push(`exit:${this.id}:${next}`);
  }
}

/** 带计数器的测试池对象。 */
class TestPoolItem implements Poolable {
  public acquired = 0;
  public released = 0;
  public destroyed = 0;

  /** 记录取出次数。 */
  public onAcquireFromPool(): void {
    this.acquired += 1;
  }

  /** 记录归还次数。 */
  public onReleaseToPool(): void {
    this.released += 1;
  }

  /** 记录销毁次数。 */
  public onDestroyFromPool(): void {
    this.destroyed += 1;
  }
}

describe('EventBus', () => {
  it('publishes typed events and unsubscribes idempotently', () => {
    const events = new EventBus<TestEvents>();
    const values: number[] = [];
    const unsubscribe = events.on('score', ({ value }) => values.push(value));
    events.emit('score', { value: 7 });
    unsubscribe();
    unsubscribe();
    events.emit('score', { value: 9 });

    expect(values).toEqual([7]);
    expect(events.listenerCount('score')).toBe(0);
  });
});

describe('StateMachine and GameManager', () => {
  it('runs exit before entering the next state', () => {
    const context: TestContext = { calls: [] };
    const machine = new StateMachine<TestContext, 'idle' | 'active'>(context);
    machine.register(new RecordingState('idle')).register(new RecordingState('active'));
    machine.start('idle');
    machine.transitionTo('active');

    expect(context.calls).toEqual([
      'enter:idle:none',
      'exit:idle:active',
      'enter:active:idle',
    ]);
  });

  it('dispatches lifecycle callbacks exactly once per transition', () => {
    const calls: string[] = [];
    const manager = GameManager.instance;
    manager.configure({
      onStart: () => calls.push('start'),
      onPause: () => calls.push('pause'),
      onResume: () => calls.push('resume'),
      onDestroy: () => calls.push('destroy'),
    });
    manager.start();
    manager.pause();
    manager.pause();
    manager.resume();
    manager.destroy();

    expect(calls).toEqual(['start', 'pause', 'resume', 'destroy']);
    expect(manager.state).toBeNull();
  });
});

describe('PoolManager', () => {
  it('reuses released objects and destroys retained instances', () => {
    const manager = new PoolManager();
    const pool = manager.createPool(() => new TestPoolItem(), {
      initialSize: 1,
      maxRetained: 1,
    });
    const first = pool.acquire();
    expect(pool.release(first)).toBe(true);
    expect(pool.release(first)).toBe(false);
    expect(pool.acquire()).toBe(first);
    expect(manager.destroyPool(pool)).toBe(true);
    expect(first.destroyed).toBe(1);
  });
});

describe('framework utilities', () => {
  it('handles deterministic math boundaries', () => {
    expect(MathUtils.clamp(12, 0, 10)).toBe(10);
    expect(MathUtils.lerp(0, 20, 0.25)).toBe(5);
    expect(MathUtils.randomInt(3, 5, () => 0.999)).toBe(5);
  });

  it('detects edge-touching collisions', () => {
    expect(CollisionUtils.circleIntersects(
      { x: 0, y: 0, radius: 5 },
      { x: 10, y: 0, radius: 5 },
    )).toBe(true);
    expect(CollisionUtils.containsPoint(
      { x: 10, y: 10, width: -10, height: -10 },
      { x: 5, y: 5 },
    )).toBe(true);
  });
});

describe('DemoStateMachine', () => {
  it('keeps business state transitions explicit', () => {
    const states: string[] = [];
    const machine = new DemoStateMachine((state) => states.push(state));
    machine.start();
    machine.pause();
    machine.resume();

    expect(states).toEqual(['ready', 'running', 'paused', 'running']);
    expect(machine.current).toBe('running');
  });
});
