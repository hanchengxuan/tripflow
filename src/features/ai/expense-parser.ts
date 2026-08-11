import { currencyOptions } from '@/constants/options';
import { getSupabaseClient } from '@/lib/supabase';

const supportedCurrencies = new Set<string>(currencyOptions.map(({ value }) => value));

export interface AiExpenseDraft {
  title: string;
  amount: string;
  currency: string;
  payerUserId: string;
  participantUserIds: string[];
  confidence: number;
  warnings: string[];
}

export function validateAiExpenseDraft(value: unknown, memberIds: string[]): AiExpenseDraft {
  if (!value || typeof value !== 'object') throw new Error('AI 返回的草稿格式无效。');
  const draft = value as Partial<AiExpenseDraft>;
  const title = typeof draft.title === 'string' ? draft.title.trim() : '';
  const amount = typeof draft.amount === 'string' ? draft.amount.trim() : '';
  const currency = typeof draft.currency === 'string' ? draft.currency.toUpperCase() : '';

  if (!title || title.length > 180) throw new Error('AI 未能识别支出名称。');
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) throw new Error('AI 未能识别有效金额。');
  if (!supportedCurrencies.has(currency)) throw new Error('AI 未能识别受支持的币种。');
  if (!draft.payerUserId || !memberIds.includes(draft.payerUserId)) throw new Error('AI 未能识别付款人。');

  const participantUserIds = Array.isArray(draft.participantUserIds)
    ? [...new Set(draft.participantUserIds.filter((id): id is string => typeof id === 'string' && memberIds.includes(id)))]
    : [];
  if (participantUserIds.length === 0) throw new Error('AI 未能识别分摊成员。');

  return {
    title,
    amount,
    currency,
    payerUserId: draft.payerUserId,
    participantUserIds,
    confidence: Math.max(0, Math.min(1, Number(draft.confidence) || 0)),
    warnings: Array.isArray(draft.warnings)
      ? draft.warnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 4)
      : [],
  };
}

export async function parseExpenseText(input: { tripId: string; text: string; memberIds: string[] }) {
  const description = input.text.trim();
  if (!description || description.length > 500) throw new Error('请输入 1 到 500 个字符的记账描述。');

  const { data, error } = await getSupabaseClient().functions.invoke('parse-expense', {
    body: { tripId: input.tripId, text: description },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    if (response) {
      try {
        const body = await response.clone().json() as { error?: unknown };
        if (typeof body.error === 'string') throw new Error(body.error);
      } catch (caught) {
        if (caught instanceof Error && /[㐀-鿿]/u.test(caught.message)) throw caught;
      }
    }
    throw error;
  }
  return validateAiExpenseDraft(data?.draft, input.memberIds);
}
