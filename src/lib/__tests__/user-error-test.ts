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

  it('explains why an expense-linked plan must be unlinked before moving', () => {
    expect(toUserMessage(new Error('Unlink related expenses before moving this plan')))
      .toBe('这项安排已关联记账，请先解除关联后再移动。');
  });

  it('does not expose target-trip validation details', () => {
    expect(toUserMessage(new Error('Only owners and editors can move to the target trip')))
      .toBe('你没有执行此操作的权限。');
    expect(toUserMessage(new Error('Item is already in this trip')))
      .toBe('请选择另一个有效的目标行程。');
  });
});
