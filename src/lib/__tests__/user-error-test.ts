import { toUserMessage } from '@/lib/user-error';

describe('toUserMessage', () => {
  it('keeps application errors that are already Chinese', () => {
    expect(toUserMessage(new Error('请输入行程名称。'))).toBe('请输入行程名称。');
  });

  it('translates known backend errors without exposing raw English', () => {
    expect(toUserMessage(new Error('Email rate limit exceeded'))).toBe('请求过于频繁，请稍后再试。');
  });

  it('uses a safe Chinese fallback for unknown backend errors', () => {
    expect(toUserMessage(new Error('unexpected internal detail'))).toBe('操作失败，请稍后重试。');
  });

  it('explains why a traveller with an open balance cannot be removed', () => {
    expect(toUserMessage(new Error("Settle this traveller's outstanding balance before removing them")))
      .toBe('该同行者还有未结清款项，请先完成结算再移出行程。');
  });
});
