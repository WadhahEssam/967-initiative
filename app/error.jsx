'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {startTransition} from 'react';
export default function ErrorPage({reset}) {
  // reset() alone re-renders the failed server payload; refresh asks the server again.
  const router = useRouter();
  const retry = () => startTransition(() => { router.refresh(); reset(); });
  return <section className="ed-notice" role="alert" aria-labelledby="error-title">
    <span className="ed-kicker">تعذّر عرض الصفحة</span>
    <h1 id="error-title">حدث خطأ أثناء تحميل هذه الصفحة.</h1>
    <p>قد يكون الاتصال بالبيانات مقطوعًا مؤقتًا. أعد المحاولة بعد قليل؛ بقية أقسام المنصة تعمل كالمعتاد.</p>
    <div className="ed-notice-actions"><button type="button" className="ed-button" onClick={retry}>إعادة المحاولة</button><Link className="ed-button" data-variant="quiet" href="/">الصفحة الرئيسية</Link></div>
  </section>;
}
