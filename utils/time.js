// 时区与按天分桶的统一工具

// 常量：一天毫秒数
export const DAY_MS = 24 * 60 * 60 * 1000

// 获取系统 IANA 时区标识（可能为空字符串）
export function systemIanaTimeZone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    return typeof tz === 'string' ? tz : ''
  } catch (_) { return '' }
}

// 指定时间点的系统本地时区偏移（分钟，UTC - Local）。
// 例如 UTC+8 返回 -480。
export function offsetMinutesAt(ts) {
  try { return new Date(ts).getTimezoneOffset() } catch (_) { return new Date().getTimezoneOffset() }
}

// 将 UTC 时间戳按系统本地时区转换为 YYYY-MM-DD 键。
// 实现：将 UTC 毫秒减去 offset，转为“伪 UTC 本地毫秒”，再用 UTC 取年月日，稳定得到本地日历下的日期键。
export function dateKeyInSystemTZ(ts) {
  const offMin = offsetMinutesAt(ts)
  const localMs = ts - offMin * 60000
  const d = new Date(localMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 取得“今天 00:00”（按系统本地时区）的 UTC 毫秒值。
export function startOfTodayUtcMsInSystemTZ() {
  const now = Date.now()
  const offMin = offsetMinutesAt(now)
  const localMs = now - offMin * 60000
  const d = new Date(localMs)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime() + offMin * 60000
}

// 将 YYYY-MM-DD 转为友好的 MM/DD 标签
export function shortLabelFromKey(key) {
  try { return key ? key.slice(5).replace('-', '/') : '' } catch (_) { return '' }
}

