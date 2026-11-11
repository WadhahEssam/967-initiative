'use client';
import Image from 'next/image';
import {useCallback, useState} from 'react';
import {canOptimizeImage, safeImageUrl} from '@/lib/media';

// One media policy for every card: unsafe URLs never reach next/image, hosts
// outside the optimizer policy are delivered directly, and a failed request
// shows the typographic placeholder instead of a broken frame.
//
// Errors are detected through a ref rather than next/image's onError prop:
// with onError, next/image re-assigns img.src after hydration to replay early
// errors, which re-downloads any image still in flight (measured: 2x bytes).
export default function SafeImage({src, alt = '', sizes, priority = false, className, placeholder = null, quality = 60}) {
  const safe = safeImageUrl(src);
  const [failed, setFailed] = useState(null);
  const watch = useCallback(img => {
    if (!img) return;
    const fail = () => setFailed(safe);
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail();
    img.addEventListener('error', fail, {once: true});
  }, [safe]);
  if (!safe || failed === safe) return placeholder;
  // A priority image is the page's largest one: ask the browser to fetch it first.
  return <Image ref={watch} src={safe} alt={alt} fill sizes={sizes} priority={priority} fetchPriority={priority ? 'high' : undefined} quality={quality} className={className} unoptimized={!canOptimizeImage(safe)}/>;
}
