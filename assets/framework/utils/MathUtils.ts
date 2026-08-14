/** ?????????? Cocos ????????? */
export class MathUtils {
  private constructor() {}

  /** ??????????? */
  public static clamp(value: number, min: number, max: number): number {
    if (min > max) throw new Error('min cannot be greater than max');
    return Math.min(max, Math.max(min, value));
  }

  /** ???????????????? */
  public static lerp(from: number, to: number, ratio: number): number {
    return from + (to - from) * ratio;
  }

  /** ??????????????????? 0? */
  public static inverseLerp(from: number, to: number, value: number): number {
    if (from === to) return 0;
    return (value - from) / (to - from);
  }

  /** ??????????????? */
  public static approximately(left: number, right: number, epsilon = 1e-6): boolean {
    return Math.abs(left - right) <= Math.max(0, epsilon);
  }

  /**
   * ?????????????????
   * @param min ???????
   * @param max ???????
   * @param randomSource ????????????????
   */
  public static randomInt(
    min: number,
    max: number,
    randomSource: () => number = Math.random,
  ): number {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    if (lower > upper) throw new Error('Integer range is empty');
    const normalized = MathUtils.clamp(randomSource(), 0, 1 - Number.EPSILON);
    return lower + Math.floor(normalized * (upper - lower + 1));
  }
}
