import { PlatformError, type PlatformKind } from './PlatformTypes';

/** 判断未知值是否可按普通键值对象读取。 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

/** 从平台 SDK 的非统一错误载荷中提取可展示消息和错误码。 */
export function toPlatformError(
  platform: PlatformKind,
  operation: string,
  detail: unknown,
  fallbackMessage = `${operation} failed`,
): PlatformError {
  if (detail instanceof PlatformError) return detail;
  if (detail instanceof Error) {
    return new PlatformError(platform, operation, detail.message || fallbackMessage, null, detail);
  }

  if (!isRecord(detail)) {
    return new PlatformError(platform, operation, fallbackMessage, null, detail);
  }

  const messageValue = detail.errMsg ?? detail.message;
  const message = typeof messageValue === 'string' && messageValue.length > 0
    ? messageValue
    : fallbackMessage;
  const codeValue = detail.errCode ?? detail.errNo ?? detail.code;
  const code = typeof codeValue === 'string' || typeof codeValue === 'number'
    ? codeValue
    : null;
  return new PlatformError(platform, operation, message, code, detail);
}

/** 创建统一的能力不可用错误。 */
export function featureUnavailable(
  platform: PlatformKind,
  operation: string,
): PlatformError {
  return new PlatformError(
    platform,
    operation,
    `${operation} is not available on ${platform}`,
    'FEATURE_UNAVAILABLE',
  );
}
