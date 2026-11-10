'use client';
import {useRef} from 'react';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {formatNumber} from '@/lib/format';

export default function Pagination({page, count, pageSize = 12, onChange}) {
  const nav = useRef(null);
  const pages = Math.ceil(count / pageSize);
  if (pages < 2) return null;
  // A new page starts at the top of its list (on a phone the reader was at the bottom). The list is
  // the element the pagination belongs to; the scroll leaves room for the sticky header.
  const go = value => {
    onChange(value);
    requestAnimationFrame(() => {
      const list = nav.current?.parentElement;
      if (!list) return;
      const top = list.getBoundingClientRect().top + window.scrollY - 90;
      if (top < window.scrollY) window.scrollTo({top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    });
  };
  return <nav ref={nav} className="pagination" aria-label="صفحات النتائج">
    <button type="button" disabled={page === 1} onClick={() => go(page - 1)}><ArrowRight size={16}/> السابق</button>
    <span aria-live="polite">{formatNumber(page)} من {formatNumber(pages)}</span>
    <button type="button" disabled={page >= pages} onClick={() => go(page + 1)}>التالي <ArrowLeft size={16}/></button>
  </nav>;
}
