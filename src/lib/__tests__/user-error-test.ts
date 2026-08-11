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
});
