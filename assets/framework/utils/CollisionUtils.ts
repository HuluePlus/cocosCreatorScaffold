/** ?????????? */
export interface Point2 {
  readonly x: number;
  readonly y: number;
}

/** ?????????????? */
export interface Rect2 extends Point2 {
  readonly width: number;
  readonly height: number;
}

/** ????? */
export interface Circle2 extends Point2 {
  readonly radius: number;
}

/** ?????????????????????????? Cocos ?????? */
export class CollisionUtils {
  private constructor() {}

  /** ??????????????????? */
  public static containsPoint(rect: Rect2, point: Point2): boolean {
    const normalized = CollisionUtils.normalizeRect(rect);
    return point.x >= normalized.x
      && point.x <= normalized.x + normalized.width
      && point.y >= normalized.y
      && point.y <= normalized.y + normalized.height;
  }

  /** ??????????????????????? */
  public static rectIntersects(left: Rect2, right: Rect2): boolean {
    const a = CollisionUtils.normalizeRect(left);
    const b = CollisionUtils.normalizeRect(right);
    return a.x <= b.x + b.width
      && a.x + a.width >= b.x
      && a.y <= b.y + b.height
      && a.y + a.height >= b.y;
  }

  /** ??????????????????? */
  public static circleIntersects(left: Circle2, right: Circle2): boolean {
    const dx = left.x - right.x;
    const dy = left.y - right.y;
    const radius = Math.max(0, left.radius) + Math.max(0, right.radius);
    return dx * dx + dy * dy <= radius * radius;
  }

  /** ?????????????? */
  public static circleRectIntersects(circle: Circle2, rect: Rect2): boolean {
    const normalized = CollisionUtils.normalizeRect(rect);
    const nearestX = Math.min(normalized.x + normalized.width, Math.max(normalized.x, circle.x));
    const nearestY = Math.min(normalized.y + normalized.height, Math.max(normalized.y, circle.y));
    const dx = circle.x - nearestX;
    const dy = circle.y - nearestY;
    const radius = Math.max(0, circle.radius);
    return dx * dx + dy * dy <= radius * radius;
  }

  /** ??????????????????????? */
  private static normalizeRect(rect: Rect2): Rect2 {
    return {
      x: rect.width >= 0 ? rect.x : rect.x + rect.width,
      y: rect.height >= 0 ? rect.y : rect.y + rect.height,
      width: Math.abs(rect.width),
      height: Math.abs(rect.height),
    };
  }
}
