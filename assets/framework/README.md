# 通用 Framework 使用说明

此目录可以整体复制到其他 Cocos Creator 3.8.x 项目。除 `BaseEntity` 依赖 `cc.Component` 外，`core/` 和 `utils/` 均为纯 TypeScript。

## 创建实体

业务实体继承 `BaseEntity<TContext>`。固定依赖通过 `initialize` 注入，复用时只在激活和停用钩子中重置瞬时状态。

```ts
import { _decorator } from 'cc';
import { BaseEntity } from '../framework/base/BaseEntity';

const { ccclass } = _decorator;

interface BulletContext {
  readonly damage: number;
}

@ccclass('BulletEntity')
export class BulletEntity extends BaseEntity<BulletContext> {
  protected onInitialize(context: BulletContext): void {
    console.log('damage', context.damage);
  }

  protected override onEntityActivated(): void {
    this.node.active = true;
  }

  protected override onEntityDeactivated(): void {
    this.unscheduleAllCallbacks();
  }
}
```

## 注册状态

状态类实现 `State<TContext, TStateId>`，业务控制器决定允许哪些迁移。

```ts
import { StateMachine, type State } from '../framework/core/StateMachine';

type BattleState = 'ready' | 'running';
interface BattleContext { elapsed: number }

class RunningState implements State<BattleContext, BattleState> {
  public readonly id = 'running' as const;

  public enter(context: BattleContext, _previous: BattleState | null): void {
    context.elapsed = 0;
  }

  public exit(_context: BattleContext, _next: BattleState): void {}

  public update(context: BattleContext, deltaTime: number): void {
    context.elapsed += deltaTime;
  }
}

const machine = new StateMachine<BattleContext, BattleState>({ elapsed: 0 });
machine.register(new RunningState());
machine.start('running');
```

状态钩子内部不要嵌套发起迁移。需要连续迁移时，在外层控制器完成当前迁移后再执行。

## 发送和监听事件

事件名和载荷通过接口集中声明，不使用无约束字符串或 `any`。

```ts
import { EventBus } from '../framework/core/EventBus';

interface BattleEvents {
  readonly 'battle:ended': { readonly won: boolean; readonly score: number };
}

const events = new EventBus<BattleEvents>();
const unsubscribe = events.on('battle:ended', ({ won, score }) => {
  console.log(won, score);
});

events.emit('battle:ended', { won: true, score: 100 });
unsubscribe();
```

组件销毁时调用 `on` 返回的取消订阅函数。组合根销毁时可以使用 `clear()` 释放全部监听器。

## 使用对象池

`PoolManager` 通过工厂创建保留具体类型的池，不使用容易混淆类型的字符串键。

```ts
const poolManager = new PoolManager();
const bulletPool = poolManager.createPool(() => createBulletEntity(), {
  initialSize: 8,
  maxRetained: 32,
});

const bullet = bulletPool.acquire();
bulletPool.release(bullet);

// 场景销毁时统一释放所有池。
poolManager.clear();
```

重复归还或跨池归还会返回 `false`。池达到最大保留数量后，多余对象直接执行 `onDestroyFromPool`。

## 接入生命周期

`GameManager` 不保存业务服务，场景入口负责注入回调：

```ts
const lifecycle = GameManager.instance;
lifecycle.configure({
  onStart: () => startGame(),
  onPause: () => pauseGame(),
  onResume: () => resumeGame(),
  onDestroy: () => destroyGame(),
});
lifecycle.start();
```

Cocos 隐藏和显示事件只调用 `pause()` 与 `resume()`，组件销毁时调用 `destroy()`。

## 依赖规则

1. `framework/` 不导入具体玩法、示例、场景或资源路径。
2. `core/` 与 `utils/` 保持引擎无关。
3. 只有 `base/BaseEntity.ts` 依赖 Cocos。
4. 业务事件表、状态迁移规则和实体配置留在业务目录。
