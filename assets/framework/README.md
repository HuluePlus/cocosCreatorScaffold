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

## 屏蔽小游戏平台差异

`createPlatformService()` 会按 `wx`、`tt`、Web 的顺序检测运行环境。业务层只依赖 `PlatformService`，不直接读取平台全局对象。广告位 ID、分享文案和服务端地址属于业务配置，不写入 framework。

```ts
import {
  createPlatformService,
  type PlatformService,
  type RewardedVideoAd,
} from '../framework';

class PlatformController {
  private readonly platform: PlatformService = createPlatformService();
  private readonly rewarded: RewardedVideoAd | null;

  public constructor(rewardedAdUnitId: string) {
    this.rewarded = this.platform.capabilities.ads.rewardedVideo
      ? this.platform.ads.createRewardedVideo({ adUnitId: rewardedAdUnitId })
      : null;
  }

  /** 只有完整观看后才由业务层发放奖励。 */
  public async tryGrantReward(): Promise<boolean> {
    if (!this.rewarded) return false;
    const result = await this.rewarded.show();
    return result.completed;
  }

  /** 场景或应用组合根销毁时释放广告和原生监听。 */
  public destroy(): void {
    this.platform.destroy();
  }
}
```

激励视频 `show()` 会先加载广告，并在关闭回调到达后返回 `{ completed, watchedCount }`。微信旧基础库没有关闭结果时按完整观看兼容；抖音多次观看会保留实际 `watchedCount`。同一平台默认只保留一个激励视频和一个插屏句柄，重复使用同一广告位会返回原句柄，切换广告位前必须先销毁旧句柄。

除广告外，平台层还统一了以下能力：

1. `account`：获取微信或抖音短期登录码，业务服务端仍负责换取和维护用户会话。
2. `share`：发起分享与配置分享菜单，不把平台回调误当成分享已送达的证明。
3. `storage`：异步读写可序列化值；Web 预览使用 `localStorage`，不可用时退回内存缓存。
4. `device`：系统信息、窗口与安全区、剪贴板、长短震动。
5. `network`：查询和监听归一化后的联网状态。
6. `lifecycle`：提供 Cocos 基础前后台事件没有携带的场景值、查询参数和来源应用信息。
7. `updates`：监听客户端检查更新、下载就绪与失败事件，并应用已下载版本。

调用可选能力前先检查 `platform.capabilities`。Web 预览中的广告、登录、分享菜单和客户端更新会抛出 `PlatformError`，不会伪造成功结果。`platform.destroy()` 会幂等销毁所有广告并移除网络、生命周期和更新监听。

```ts
const platform = createPlatformService();
const launch = platform.lifecycle.getLaunchContext();
const login = platform.capabilities.login
  ? await platform.account.login()
  : null;

await platform.storage.set('settings', { music: true, volume: 0.8 });
const safeArea = platform.device.getSystemInfo().safeArea;

const unsubscribe = platform.network.onChange(({ connected }) => {
  console.log('network connected', connected);
});

// 单独退订，或最终交给 platform.destroy() 统一清理。
unsubscribe();
console.log(launch.scene, login?.code, safeArea);
```

### 不应伪装成通用 API 的能力

以下差异无法只靠客户端方法签名安全屏蔽，应该在具体项目中基于 `PlatformService.kind` 注入独立业务适配器：

- 支付、虚拟商品和退款：商品模型、系统限制、签名及服务端回调完全不同。
- 开放数据域、好友榜和平台社交关系：数据权限与渲染模型不同。
- 云托管、云函数和账号绑定：直接绑定平台后端与用户体系。
- 录屏、直播、侧边栏复访等平台独占流量能力：不存在等价的跨平台语义。
- 用户资料、隐私协议和授权弹窗：受基础库版本、用户手势及审核政策约束，必须由业务合规流程决定。
- 请求域名白名单、分包规则、包体限制和发布参数：属于构建与平台后台配置，运行时抽象无法替代。

普通场景、渲染、输入、音频和资源加载继续使用 Cocos Creator API；不要在平台层重复封装引擎已经稳定屏蔽的能力。

## 依赖规则

1. `framework/` 不导入具体玩法、示例、场景或资源路径。
2. `core/` 与 `utils/` 保持引擎无关。
3. `platform/` 保持纯 TypeScript，通过构造参数注入最小 SDK 接口，不声明全局 `wx` 或 `tt`。
4. `base/`、`audio/` 和 `effects/` 只依赖 Cocos 基础 API 与 framework 纯 TypeScript 模块。
5. 业务事件表、状态迁移规则、资源加载、广告位和平台后台配置留在业务目录；游戏数值集中放在业务目录的配置文件中，framework 不读取具体玩法数值。
