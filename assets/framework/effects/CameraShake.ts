import { _decorator, Component } from 'cc';
import {
  ShakeModel,
  type ShakeImpulseOptions,
  type ShakeSample,
} from '../core/ShakeModel';

const { ccclass } = _decorator;

/**
 * 为 2D 摄像机节点提供可叠加的程序化震动。
 * 推荐将组件挂在独立的 Camera 子节点上，让跟随逻辑移动其父节点，避免多个脚本同时写入同一变换。
 */
@ccclass('CameraShake')
export class CameraShake extends Component {
  private readonly model = new ShakeModel();
  private appliedX = 0;
  private appliedY = 0;
  private appliedRotation = 0;

  /** 当前是否存在尚未结束的震动。 */
  public get shaking(): boolean {
    return this.model.active;
  }

  /**
   * 触发一次震动，连续调用会叠加冲击。
   * @returns 参数能产生可见偏移时返回 true。
   */
  public shake(options: ShakeImpulseOptions = {}): boolean {
    return this.model.add(options);
  }

  /** 立即停止震动并恢复组件施加前的节点变换。 */
  public stop(): void {
    this.model.stop();
    this.applySample({ x: 0, y: 0, rotation: 0 });
  }

  /** 在其他组件完成普通移动后叠加本帧震动偏移。 */
  protected override lateUpdate(deltaTime: number): void {
    if (!this.model.active && this.isRestored()) return;
    this.applySample(this.model.update(deltaTime));
  }

  /** 组件停用时不保留停在半途的画面偏移。 */
  protected override onDisable(): void {
    this.stop();
  }

  /** 组件销毁前恢复节点，避免编辑器或复用节点继承偏移。 */
  protected override onDestroy(): void {
    this.stop();
  }

  /** 将旧偏移替换成本帧偏移，并保留节点的基础位置和 XY 旋转。 */
  private applySample(sample: ShakeSample): void {
    if (!this.node.isValid) return;
    const position = this.node.position;
    this.node.setPosition(
      position.x - this.appliedX + sample.x,
      position.y - this.appliedY + sample.y,
      position.z,
    );

    const euler = this.node.eulerAngles;
    this.node.setRotationFromEuler(
      euler.x,
      euler.y,
      euler.z - this.appliedRotation + sample.rotation,
    );
    this.appliedX = sample.x;
    this.appliedY = sample.y;
    this.appliedRotation = sample.rotation;
  }

  /** 判断组件是否已完全撤销自己的偏移。 */
  private isRestored(): boolean {
    return this.appliedX === 0 && this.appliedY === 0 && this.appliedRotation === 0;
  }
}
