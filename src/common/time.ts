/**
 * 时区工具：统一以中国时区（UTC+8）呈现时间。
 *
 * 约定：数据库 DATETIME 列仍按 UTC 存储（字面值即 UTC 墙钟），
 * 仅在「应用层/接口输出」处统一换算为北京时间，避免存量数据迁移。
 */

export const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 将 Date（或可被 Date 解析的值）格式为北京时间 ISO 字符串。
 * 例：2026-09-07T12:00:00.000+08:00
 * 入参为 null/undefined/非法值时返回 undefined（便于可空字段透传）。
 */
export function toBeijingISO(
  value: Date | string | number | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  // 把绝对时刻整体平移到北京墙钟，再用 UTC getter 取出各字段
  const bj = new Date(date.getTime() + BEIJING_OFFSET_MS);
  const p = (n: number, len = 2) => String(n).padStart(len, '0');
  return (
    `${bj.getUTCFullYear()}-${p(bj.getUTCMonth() + 1)}-${p(bj.getUTCDate())}` +
    `T${p(bj.getUTCHours())}:${p(bj.getUTCMinutes())}:${p(bj.getUTCSeconds())}` +
    `.${p(bj.getUTCMilliseconds(), 3)}+08:00`
  );
}

/**
 * 递归把对象/数组里的所有 Date 实例转成北京时间 ISO 字符串。
 * 供全局 BeijingTimeInterceptor 与需要手动序列化（如 @Res 直写响应）的接口复用，
 * 保证无论走不走拦截器，时间字段输出口径都一致（+08:00）。
 */
export function convertDatesToBeijing(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value == null) return value;
  if (value instanceof Date) return toBeijingISO(value);
  if (Array.isArray(value)) {
    return value.map((item) => convertDatesToBeijing(item, seen));
  }
  if (typeof value === 'object') {
    // Buffer 等非普通对象不处理
    if (Buffer.isBuffer(value)) return value;
    if (seen.has(value)) return value;
    seen.add(value);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = convertDatesToBeijing(v, seen);
    }
    return out;
  }
  return value;
}

/**
 * 计算「北京时间口径」的年份/月份边界，返回 UTC 绝对时刻（用于查询 UTC 存储的列）。
 * - 仅传 year：覆盖北京时间当年 1 月 1 日 00:00 ~ 次年 1 月 1 日 00:00
 * - 传 year + month(1-12)：覆盖北京时间当月 1 日 00:00 ~ 次月 1 日 00:00
 * 因为存储为 UTC，北京边界 = 对应 UTC 边界减 8 小时。
 */
export function beijingMonthRange(
  year: number,
  month?: number,
): { gte: Date; lt: Date } {
  const gte = new Date(Date.UTC(year, month ? month - 1 : 0, 1) - BEIJING_OFFSET_MS);
  const lt = new Date(Date.UTC(year, month ?? 12, 1) - BEIJING_OFFSET_MS);
  return { gte, lt };
}
