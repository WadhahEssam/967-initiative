'use client';
import {useEffect, useState} from 'react';
import SignupInvite from '@/components/SignupInvite';
import {browserMayBeSignedIn} from '@/lib/browserSession';
import styles from './GameSignupInvite.module.css';

// Shown to visitors at the end of a practice round: the daily challenge, points and the weekly
// ranking need an account. Members never see it.
export default function GameSignupInvite() {
  const [guest, setGuest] = useState(false);
  useEffect(() => { setGuest(!browserMayBeSignedIn()); }, []);
  if (!guest) return null;
  return <SignupInvite className={styles.invite} primaryClassName={styles.primary} secondaryClassName={styles.secondary} showLogin next="/games"
    text="أعجبتك الجولة؟ أنشئ حسابًا مجانًا لتشارك في تحدي اليوم، وتجمع النقاط، وتظهر في الترتيب الأسبوعي."/>;
}
