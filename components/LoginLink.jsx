'use client';
import {useEffect, useState} from 'react';
import Link from 'next/link';

// A sign-in (or sign-up) link that brings the visitor back to this page afterwards (?next=).
// The return path is added after mount, so the server HTML and the first render agree.
export default function LoginLink({href = '/login', children, ...props}) {
  const [target, setTarget] = useState(href);
  useEffect(() => {
    setTarget(href + (href.includes('?') ? '&' : '?') + 'next=' + encodeURIComponent(location.pathname + location.search + location.hash));
  }, [href]);
  return <Link href={target} {...props}>{children}</Link>;
}
