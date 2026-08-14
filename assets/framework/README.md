# 通用 Framework 使用说明

此目录可以整体复制到其他 Cocos Creator 3.8.x 项目。`core/` 和 `utils/` 保持纯 TypeScript；`base/`、`audio/` 与 `effects/` 使用 Cocos 基础 API。

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

事件名和载荷通过接口集中声明，不使用无约束字符串或弱类型载荷。

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

组件销毁时调用 `on` 返回的取消订阅函数。组合根销毁时也可以使用 `clear()` 释放全部监听器。

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

## 播放音乐与音效

`AudioManager` 不保存资源路径，也不负责加载。业务层加载 `AudioClip` 后传入管理器，并在所属组件销毁时释放管理器。

```ts
import { AudioClip, resources } from 'cc';
import { AudioManager } from '../framework/audio/AudioManager';

const audio = new AudioManager(sceneRoot, {
  maxConcurrentEffects: 8,
  overflowPolicy: 'replace-oldest',
  musicVolume: 0.7,
});

resources.load('audio/bgm', AudioClip, (error, clip) => {
  if (!error) audio.playMusic(clip, { loop: true });
});

resources.load('audio/hit', AudioClip, (error, clip) => {
  if (!error) audio.playEffect(clip, { volumeScale: 0.8 });
});

audio.pauseAll();  // 应用进入后台
audio.resumeAll(); // 应用返回前台
audio.destroy();   // 组件或场景销毁
```

`masterVolume`、`musicVolume`、`effectsVolume` 和 `muted` 可以直接设置。`playEffect` 返回的句柄能提前停止该次播放，槽位复用后旧句柄不会误停新音效。Web 首次播放仍受浏览器自动播放策略限制，首个用户手势到来前由引擎排队。

## 添加摄像机震动

将 `CameraShake` 挂到 2D Camera 节点，碰撞、受击或爆炸时调用 `shake`。连续调用会叠加，内部最多保留八个冲击。

```ts
import { CameraShake } from '../framework/effects/CameraShake';

const cameraShake = cameraNode.getComponent(CameraShake)
  ?? cameraNode.addComponent(CameraShake);

cameraShake.shake({
  duration: 0.2,
  strength: 10,
  frequency: 24,
  rotation: 0.25,
});
```

震动在 `lateUpdate` 中施加，并在组件停用或销毁时恢复节点变换。如果项目有摄像机跟随逻辑，推荐让跟随脚本移动父节点，让 `CameraShake` 只修改独立的 Camera 子节点。

## 接入生命周期

`GameManager` 不保存业务服务，场景入口负责注入回调。

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

Cocos 隐藏和显示事件只调用 `pause()` 与 `resume()`，组件销毁时调用 `destroy()`。音频等具体服务由这些业务回调负责暂停、恢复和释放。

## 依赖规则

1. `framework/` 不导入具体玩法、示例、场景或资源路径。
2. `core/` 与 `utils/` 保持引擎无关。
3. `base/`、`audio/` 和 `effects/` 只依赖 Cocos 基础 API 与 framework 纯 TypeScript 模块。
4. 业务事件表、状态迁移规则、资源加载和实体配置留在业务目录。
