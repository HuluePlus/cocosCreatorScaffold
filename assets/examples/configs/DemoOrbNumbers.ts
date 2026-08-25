/**
 * 示例圆点的玩法数值。
 * 速度、寿命和生成边距由控制器读取，实体本身只负责执行行为。
 */
export const DEMO_ORB_NUMBERS = {
  radius: 18,
  spawnPadding: 40,
  speedMin: 90,
  speedMax: 190,
  lifetimeMin: 10,
  lifetimeMax: 18,
} as const;
