import { Color, Node } from 'cc';
import { EventBus } from '../../framework/core/EventBus';
import { PoolManager, type ObjectPool } from '../../framework/core/PoolManager';
import type { Rect2 } from '../../framework/utils/CollisionUtils';
import { MathUtils } from '../../framework/utils/MathUtils';
import type { DemoEventMap } from '../configs/DemoEvents';
import { DemoOrb } from '../entities/DemoOrb';
import { DemoStateMachine, type DemoRunState } from './DemoStateMachine';

const MAX_ACTIVE_ORBS = 24;
const INITIAL_POOL_SIZE = 8;
const ORB_COLORS: readonly Color[] = [
  new Color(78, 205, 196),
  new Color(255, 107, 107),
  new Color(255, 209, 102),
  new Color(129, 140, 248),
  new Color(244, 162, 97),
];

/**
 * 示例业务控制器，组合状态机、事件总线、对象池和实体。
 * 它不创建 HUD，所有可视化统计通过 DemoEventMap 对外发布。
 */
export class DemoController {
  private readonly poolManager = new PoolManager();
  private readonly pool: ObjectPool<DemoOrb>;
  private readonly activeOrbs = new Set<DemoOrb>();
  private readonly activeCollisionPairs = new Set<string>();
  private readonly stateMachine: DemoStateMachine;
  private createdCount = 0;
  private nextOrbId = 1;
  private collisionCount = 0;

  public constructor(
    private readonly host: Node,
    private readonly arena: Rect2,
    private readonly events: EventBus<DemoEventMap>,
  ) {
    this.stateMachine = new DemoStateMachine((state) => {
      this.events.emit('demo:state-changed', { state });
    });
    this.pool = this.poolManager.createPool(() => this.createOrb(), {
      initialSize: INITIAL_POOL_SIZE,
      maxRetained: MAX_ACTIVE_ORBS,
    });
    this.publishPopulation();
  }

  /** 返回当前示例运行状态。 */
  public get state(): DemoRunState {
    return this.stateMachine.current;
  }

  /** 启动实体更新。 */
  public start(): void {
    this.stateMachine.start();
  }

  /** 暂停实体更新。 */
  public pause(): void {
    this.stateMachine.pause();
  }

  /** 恢复实体更新。 */
  public resume(): void {
    this.stateMachine.resume();
  }

  /** 在运行和暂停之间切换。 */
  public toggle(): void {
    this.stateMachine.toggle();
  }

  /**
   * 从对象池生成指定数量的圆点。
   * @param count 期望生成数量，超过上限的部分会被忽略。
   */
  public spawn(count: number): void {
    const availableSlots = Math.max(0, MAX_ACTIVE_ORBS - this.activeOrbs.size);
    const spawnCount = Math.min(availableSlots, Math.max(0, Math.floor(count)));
    for (let index = 0; index < spawnCount; index += 1) {
      const orb = this.pool.acquire();
      const angle = Math.random() * Math.PI * 2;
      const speed = MathUtils.randomInt(90, 190);
      orb.launch({
        id: this.nextOrbId,
        x: MathUtils.randomInt(Math.ceil(this.arena.x + 40), Math.floor(this.arena.x + this.arena.width - 40)),
        y: MathUtils.randomInt(Math.ceil(this.arena.y + 40), Math.floor(this.arena.y + this.arena.height - 40)),
        velocityX: Math.cos(angle) * speed,
        velocityY: Math.sin(angle) * speed,
        lifetime: MathUtils.randomInt(10, 18),
        color: ORB_COLORS[(this.nextOrbId - 1) % ORB_COLORS.length],
      });
      this.nextOrbId += 1;
      this.activeOrbs.add(orb);
    }
    this.publishPopulation();
  }

  /**
   * 推进所有实体并检测首次接触的碰撞对。
   * @param deltaTime 距离上一帧的秒数。
   */
  public update(deltaTime: number): void {
    if (this.state !== 'running') return;
    for (const orb of [...this.activeOrbs]) orb.step(deltaTime);

    const orbs = [...this.activeOrbs];
    const currentPairs = new Set<string>();
    for (let left = 0; left < orbs.length; left += 1) {
      for (let right = left + 1; right < orbs.length; right += 1) {
        const first = orbs[left];
        const second = orbs[right];
        if (!first.intersects(second)) continue;
        const key = `${Math.min(first.id, second.id)}:${Math.max(first.id, second.id)}`;
        currentPairs.add(key);
        if (this.activeCollisionPairs.has(key)) continue;
        first.exchangeVelocityWith(second);
        this.collisionCount += 1;
        this.events.emit('demo:collision', { total: this.collisionCount });
      }
    }
    this.activeCollisionPairs.clear();
    for (const pair of currentPairs) this.activeCollisionPairs.add(pair);
  }

  /** 将所有活跃实体归还对象池。 */
  public clear(): void {
    for (const orb of [...this.activeOrbs]) this.releaseOrb(orb);
    this.activeCollisionPairs.clear();
    this.publishPopulation();
  }

  /** 清理活跃实体和对象池，释放全部 Cocos 节点。 */
  public destroy(): void {
    this.clear();
    this.poolManager.clear();
  }

  /** 通过工厂创建并初始化一个新的池对象。 */
  private createOrb(): DemoOrb {
    const node = new Node(`PooledOrb:${this.createdCount + 1}`);
    this.host.addChild(node);
    const orb = node.addComponent(DemoOrb);
    orb.initialize({
      arena: this.arena,
      onExpired: (expired) => this.releaseOrb(expired),
    });
    node.active = false;
    this.createdCount += 1;
    return orb;
  }

  /** 将单个实体安全归还池，并更新统计。 */
  private releaseOrb(orb: DemoOrb): void {
    if (!this.activeOrbs.delete(orb)) return;
    this.pool.release(orb);
    this.publishPopulation();
  }

  /** 发布对象池与活跃实体统计。 */
  private publishPopulation(): void {
    this.events.emit('demo:population-changed', {
      active: this.activeOrbs.size,
      pooled: this.pool.availableCount,
      created: this.createdCount,
    });
  }
}
