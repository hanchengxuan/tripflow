import { useEffect, useRef, useState } from 'react';

import { type PlaceSuggestion, searchPlaces } from '@/features/places/place-search';

function newSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function usePlaceSuggestions(value: string, locale: string) {
  const [query, setQuery] = useState<string>();
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const sessionToken = useRef(newSessionToken());

  useEffect(() => {
    if (query !== value || query.trim().length < 3) return;
    const id = ++request.current;
    const timer = setTimeout(() => {
      setLoading(true);
      void searchPlaces(query, locale, sessionToken.current)
        .then((next) => { if (request.current === id) setSuggestions(next); })
        .catch(() => { if (request.current === id) setFailed(true); })
        .finally(() => { if (request.current === id) setLoading(false); });
    }, 450);
    return () => { clearTimeout(timer); request.current += 1; };
  }, [locale, query, value]);

  function reset() {
    request.current += 1;
    setSuggestions([]);
    setLoading(false);
    setFailed(false);
  }

  return {
    suggestions: query === value ? suggestions : [],
    loading: query === value && loading,
    failed: query === value && failed,
    change: (next: string) => { reset(); setQuery(next); },
    select: () => { reset(); setQuery(undefined); sessionToken.current = newSessionToken(); },
  };
}
