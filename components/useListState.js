'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {listStateSearch, readListState} from '@/lib/listState';

// Native history keeps filters shareable without fetching the collection again.
export default function useListState(defaults) {
  const initial = useRef(defaults);
  const current = useRef(defaults);
  const [state, setState] = useState(defaults);
  useEffect(() => {
    const restore = () => {
      current.current = readListState(window.location.search, initial.current);
      setState(current.current);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  const update = useCallback(patch => {
    const changes = typeof patch === 'function' ? patch(current.current) : patch;
    const next = {...current.current, ...changes};
    current.current = next;
    setState(next);
    const url = window.location.pathname + listStateSearch(window.location.search, next, initial.current) + window.location.hash;
    window.history.replaceState(null, '', url);
  }, []);
  return [state, update];
}
