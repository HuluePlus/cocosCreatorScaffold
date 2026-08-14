const DEFAULT_DURATION = 0.25;
const DEFAULT_STRENGTH = 12;
const DEFAULT_FREQUENCY = 24;
const GOLDEN_ANGLE = 2.399963229728653;

/** 单次震动冲击的可调参数。 */
export interface ShakeImpulseOptions {
  readonly duration?: number;
  readonly strength?: number;
  readonly frequency?: number;
  readonly rotation?: number;
  readonly decay?: boolean;
}

/** 某一帧需要叠加到目标上的位置与旋转偏移。 */
export interface ShakeSample {
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

interface ActiveImpulse {
  readonly duration: number;
  readonly strength: number;
  readonly frequency: number;
  readonly rotation: number;
  readonly decay: boolean;
  readonly phase: number;
  elapsed: number;
}

/**
 * 与渲染引擎无关的震动采样器。
 * 多个冲击可以叠加，超过容量时优先丢弃最早加入的冲击，避免高频事件无限增长。
 */
export class ShakeModel {
  private readonly impulses: ActiveImpulse[] = [];
  private sequence = 0;

  public constructor(private readonly maxImpulses = 8) {
    if (!Number.isInteger(maxImpulses) || maxImpulses <= 0) {
      throw new Error('maxImpulses must be a positive integer');
    }
  }

  /** 当前是否仍有需要采样的震动冲击。 */
  public get active(): boolean {
    return this.impulses.length > 0;
  }

  /**
   * 加入一次震动冲击。
   * @returns 参数能产生可见偏移时返回 true，否则返回 false。
   */
  public add(options: ShakeImpulseOptions = {}): boolean {
    const duration = this.finite(options.duration ?? DEFAULT_DURATION, 'duration');
    const strength = Math.max(0, this.finite(options.strength ?? DEFAULT_STRENGTH, 'strength'));
    const frequency = Math.max(0, this.finite(options.frequency ?? DEFAULT_FREQUENCY, 'frequency'));
    const rotation = Math.max(0, this.finite(options.rotation ?? 0, 'rotation'));
    if (duration <= 0 || (strength === 0 && rotation === 0)) return false;

    if (this.impulses.length >= this.maxImpulses) this.impulses.shift();
    this.impulses.push({
      duration,
      strength,
      frequency,
      rotation,
      decay: options.decay ?? true,
      phase: this.sequence * GOLDEN_ANGLE,
      elapsed: 0,
    });
    this.sequence += 1;
    return true;
  }

  /**
   * 推进时间并返回所有有效冲击的合成偏移。
   * @param deltaTime 距离上一帧的秒数，负数按 0 处理。
   */
  public update(deltaTime: number): ShakeSample {
    const step = Math.max(0, this.finite(deltaTime, 'deltaTime'));
    let x = 0;
    let y = 0;
    let rotation = 0;
    let writeIndex = 0;

    for (const impulse of this.impulses) {
      impulse.elapsed += step;
      if (impulse.elapsed >= impulse.duration) continue;

      const progress = impulse.elapsed / impulse.duration;
      const envelope = impulse.decay ? 1 - progress : 1;
      const angle = impulse.elapsed * impulse.frequency * Math.PI * 2 + impulse.phase;
      x += Math.sin(angle) * impulse.strength * envelope;
      y += Math.cos(angle * 1.137 + impulse.phase * 0.71) * impulse.strength * envelope;
      rotation += Math.sin(angle * 0.83 + impulse.phase * 1.31) * impulse.rotation * envelope;
      this.impulses[writeIndex] = impulse;
      writeIndex += 1;
    }

    this.impulses.length = writeIndex;
    return { x, y, rotation };
  }

  /** 立即清除全部冲击。 */
  public stop(): void {
    this.impulses.length = 0;
  }

  /** 验证外部传入的数值，避免无效值污染节点变换。 */
  private finite(value: number, name: string): number {
    if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
    return value;
  }
}
