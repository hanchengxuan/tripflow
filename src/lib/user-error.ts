const translations: [RegExp, string][] = [
  [/invalid login credentials|invalid.*token|token.*invalid/i, '登录信息无效，请重新获取验证码。'],
  [/email rate limit|rate limit/i, '请求过于频繁，请稍后再试。'],
  [/expired/i, '该链接或邀请码已过期，请重新获取。'],
  [/authentication required|not authenticated|jwt/i, '登录状态已失效，请重新登录。'],
  [/trip name.*required/i, '请输入行程名称。'],
  [/end date.*before|starts_on.*ends_on/i, '结束日期不能早于开始日期。'],
  [/currency/i, '请选择有效币种。'],
  [/time.?zone/i, '请选择有效时区。'],
  [/settle.*outstanding balance.*before removing/i, '该同行者还有未结清款项，请先完成结算再移出行程。'],
  [/target trip.*not found|item is already in this trip/i, '请选择另一个有效的目标行程。'],
  [/only.*owner|permission denied|not permitted|row-level security/i, '你没有执行此操作的权限。'],
  [/membership required|not.*member/i, '你还不是该行程的成员。'],
  [/invite/i, '邀请码无效或已过期。'],
  [/network|fetch failed/i, '网络连接失败，请检查网络后重试。'],
];

export function toUserMessage(caught: unknown, fallback = '操作失败，请稍后重试。') {
  if (!(caught instanceof Error)) return fallback;
  if (/[㐀-鿿]/u.test(caught.message)) return caught.message;
  return translations.find(([pattern]) => pattern.test(caught.message))?.[1] ?? fallback;
}
