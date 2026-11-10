'use client';
// مدرسة 967 — بطاقة «تابع من حيث توقفت» في الصفحة الرئيسية للمدرسة (للمسجّلين فقط؛ لا تظهر للزائر).
import {useEffect, useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, PlayCircle, CalendarCheck2} from 'lucide-react';
import {currentSession} from '@/lib/browserSession';
import GuestProgressClaim from './GuestProgressClaim';
import styles from './SchoolContinueCard.module.css';

export default function SchoolContinueCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const auth = {session: await currentSession()};
        const token = auth?.session?.access_token;
        if (!token) return;
        const res = await fetch('/api/school/dashboard', {cache: 'no-store', headers: {Authorization: 'Bearer ' + token}});
        if (!res.ok) return;
        const json = await res.json();
        if (alive && json?.resume?.stage?.href) setData(json);
      } catch { /* البطاقة اختيارية: لا تعطل الصفحة */ }
    })();
    return () => { alive = false; };
  }, []);
  // Lessons finished as a guest move into the account on the first visit after signing in. The
  // claim keeps the same place in the tree whether or not the card has loaded, so it is not remounted mid-transfer.
  if (!data) return <><GuestProgressClaim/>{null}</>;
  const {resume, xp} = data;
  return <><GuestProgressClaim/><section className={styles.card} aria-label="تابع من حيث توقفت">
    <span className={styles.icon} aria-hidden="true"><PlayCircle size={30}/></span>
    <div className={styles.text}>
      <span>تابع من حيث توقفت</span>
      <strong>{resume.course}</strong>
      <small>الدرس {resume.stage.index + 1}: {resume.stage.title}{xp?.level ? ` · المستوى ${xp.level}` : ''}</small>
    </div>
    <div className={styles.actions}>
      <Link className={styles.go} href={resume.stage.href}>تابع <ArrowLeft size={18} aria-hidden="true"/></Link>
      <Link className={styles.review} href="/school/review"><CalendarCheck2 size={17} aria-hidden="true"/> مراجعة اليوم</Link>
    </div>
  </section></>;
}
