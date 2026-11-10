'use client';
import {useEffect} from 'react';

// Links such as /#about point at a folded <details>; open it so the reader sees its content.
export default function OpenFoldOnHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const fold = id && document.getElementById(id);
      if (fold instanceof HTMLDetailsElement && !fold.open) { fold.open = true; fold.scrollIntoView({block: 'start'}); }
    };
    open();
    addEventListener('hashchange', open);
    return () => removeEventListener('hashchange', open);
  }, []);
  return null;
}
