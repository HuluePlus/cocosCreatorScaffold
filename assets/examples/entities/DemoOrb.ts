import { _decorator, Color, Graphics, UITransform, Vec2 } from 'cc';
import { BaseEntity } from '../../framework/base/BaseEntity';
import { CollisionUtils, type Circle2, type Rect2 } from '../../framework/utils/CollisionUtils';
import { MathUtils } from '../../framework/utils/MathUtils';

const { ccclass } = _decorator;

/** 池化圆点初始化上下文。 */
export interface DemoOrbContext {
  readonly arena: Rect2;
  readonly onExpired: (orb: DemoOrb) => void;
}

/** 单次发射圆点的瞬时参数。 */
export interface DemoOrbLaunchOptions {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly lifetime: number;
  readonly color: Color;
}

const ORB_RADIUS = 18;

/**
 * 可池化的示例实体。
 * 圆点由 DemoController 统一驱动，不自行注册全局事件或定时器，便于可靠暂停和回收。
 */
@ccclass('DemoOrb')
export class DemoOrb extends BaseEntity<DemoOrbContext> {
  private readonly velocity = new Vec2();
  private graphics!: Graphics;
  private entityId = 0;
  private remainingLifetime = 0;
  private launched = false;

  /** 返回当前实例编号，用于稳定构造碰撞对标识。 */
  public get id(): number {
    return this.entityId;
  }

  /** 创建圆点所需的 Cocos 组件，长期上下文由 BaseEntity 保存。 */
  protected onInitialize(_context: DemoOrbContext): void {
    const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    transform.setContentSize(ORB_RADIUS * 2 + 8, ORB_RADIUS * 2 + 8);
    this.graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
  }

  /**
   * 配置一次新的发射。
   * @param options 位置、速度、寿命和颜色。
   */
  public launch(options: DemoOrbLaunchOptions): void {
    this.entityId = options.id;
    this.remainingLifetime = options.lifetime;
    this.velocity.set(options.velocityX, options.velocityY);
    this.node.setPosition(options.x, options.y);
    this.draw(options.color);
    this.launched = true;
  }

  /**
   * 推进实体运动并处理场地边界。
   * @param deltaTime 距离上一帧的秒数。
   */
  public step(deltaTime: number): void {
    if (!this.launched) return;
    this.remainingLifetime -= Math.max(0, deltaTime);
    if (this.remainingLifetime <= 0) {
      this.launched = false;
      this.context.onExpired(this);
      return;
    }

    const arena = this.context.arena;
    const innerBounds: Rect2 = {
      x: arena.x + ORB_RADIUS,
      y: arena.y + ORB_RADIUS,
      width: Math.max(0, arena.width - ORB_RADIUS * 2),
      height: Math.max(0, arena.height - ORB_RADIUS * 2),
    };
    let nextX = this.node.position.x + this.velocity.x * deltaTime;
    let nextY = this.node.position.y + this.velocity.y * deltaTime;

    // 先判断完整下一步是否仍在有效范围，再分别反射越界轴，避免角落抖动。
    if (!CollisionUtils.containsPoint(innerBounds, { x: nextX, y: nextY })) {
      if (nextX < innerBounds.x || nextX > innerBounds.x + innerBounds.width) {
        this.velocity.x *= -1;
        nextX = MathUtils.clamp(nextX, innerBounds.x, innerBounds.x + innerBounds.width);
      }
      if (nextY < innerBounds.y || nextY > innerBounds.y + innerBounds.height) {
        this.velocity.y *= -1;
        nextY = MathUtils.clamp(nextY, innerBounds.y, innerBounds.y + innerBounds.height);
      }
    }
    this.node.setPosition(nextX, nextY);
  }

  /** 判断是否与另一个圆点相交。 */
  public intersects(other: DemoOrb): boolean {
    return CollisionUtils.circleIntersects(this.circle(), other.circle());
  }

  /** 交换两个圆点的速度，形成轻量且稳定的碰撞反馈。 */
  public exchangeVelocityWith(other: DemoOrb): void {
    const ownX = this.velocity.x;
    const ownY = this.velocity.y;
    this.velocity.set(other.velocity.x, other.velocity.y);
    other.velocity.set(ownX, ownY);
  }

  /** 从池中取出后只恢复节点；具体发射参数紧接着由控制器设置。 */
  protected override onEntityActivated(): void {
    this.node.setScale(1, 1, 1);
  }

  /** 归还池时清除瞬时运行状态，避免下次复用继承旧寿命。 */
  protected override onEntityDeactivated(): void {
    this.launched = false;
    this.remainingLifetime = 0;
    this.velocity.set(0, 0);
  }

  /** 返回当前圆形碰撞数据。 */
  private circle(): Circle2 {
    return {
      x: this.node.position.x,
      y: this.node.position.y,
      radius: ORB_RADIUS,
    };
  }

  /** 绘制圆点阴影、主体和高光，颜色由每次发射参数决定。 */
  private draw(fill: Color): void {
    this.graphics.clear();
    this.graphics.fillColor = new Color(0, 0, 0, 42);
    this.graphics.circle(2, -4, ORB_RADIUS + 2);
    this.graphics.fill();
    this.graphics.fillColor = fill;
    this.graphics.circle(0, 0, ORB_RADIUS);
    this.graphics.fill();
    this.graphics.fillColor = new Color(255, 255, 255, 150);
    this.graphics.circle(-6, 7, 5);
    this.graphics.fill();
  }
}
