import { useEffect, useState } from 'react';

import { fetchExchangeRate, type ExchangeRateResult } from '@/features/currency/exchange-rate';

export type ExchangeRateLoadState = {
  pairKey: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  rate?: number;
  date?: string;
  source?: ExchangeRateResult['source'];
  cached?: boolean;
};

export function useExchangeRate({
  sourceCurrency,
  targetCurrency,
  enabled,
}: {
  sourceCurrency: string;
  targetCurrency: string;
  enabled: boolean;
}): ExchangeRateLoadState {
  const source = sourceCurrency.trim().toUpperCase();
  const target = targetCurrency.trim().toUpperCase();
  const pairKey = `${source}/${target}`;
  const [state, setState] = useState<ExchangeRateLoadState>({ pairKey: '', status: 'idle' });
  const shouldLoad = enabled && Boolean(source) && Boolean(target) && source !== target;

  useEffect(() => {
    if (!shouldLoad) return undefined;

    const controller = new AbortController();
    let active = true;
    void fetchExchangeRate(source, target, controller.signal)
      .then((result) => {
        if (!active) return;
        setState({
          pairKey,
          status: 'success',
          rate: result.rate,
          date: result.date,
          source: result.source,
          cached: result.cached,
        });
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setState({ pairKey, status: 'error' });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [pairKey, shouldLoad, source, target]);

  if (!shouldLoad) return { pairKey, status: 'idle' };
  if (state.pairKey !== pairKey) return { pairKey, status: 'loading' };
  return state;
}
