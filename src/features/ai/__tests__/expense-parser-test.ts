import { validateAiExpenseDraft } from '@/features/ai/expense-parser';

describe('validateAiExpenseDraft', () => {
  const members = ['user-a', 'user-b', 'user-c'];

  it('accepts a structured draft containing only known trip members', () => {
    expect(validateAiExpenseDraft({
      title: '晚餐',
      amount: '860.00',
      currency: 'hkd',
      payerUserId: 'user-b',
      participantUserIds: ['user-a', 'user-b', 'user-b'],
      confidence: 0.94,
      warnings: [],
    }, members)).toEqual({
      title: '晚餐',
      amount: '860.00',
      currency: 'HKD',
      payerUserId: 'user-b',
      participantUserIds: ['user-a', 'user-b'],
      confidence: 0.94,
      warnings: [],
    });
  });

  it('rejects payer IDs outside the active trip', () => {
    expect(() => validateAiExpenseDraft({
      title: '车费',
      amount: '120',
      currency: 'CNY',
      payerUserId: 'attacker',
      participantUserIds: ['user-a'],
      confidence: 1,
      warnings: [],
    }, members)).toThrow('AI 未能识别付款人。');
  });
});
