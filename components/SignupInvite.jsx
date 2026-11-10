'use client';
import {useEffect} from 'react';
import Link from 'next/link';
import {trackFunnel} from '@/components/analytics/funnel';

// The invitation shown to visitors after they finish something (a lesson, a game round).
// Counts how often it is seen and used (signup_prompt_shown / signup_prompt_click).
export default function SignupInvite({text, next, className, primaryClassName, secondaryClassName, cta = 'أنشئ حسابًا مجانًا', showLogin = false}) {
  useEffect(() => { trackFunnel('signup_prompt_shown', next); }, [next]);
  const target = encodeURIComponent(next);
  return <section className={className}>
    <p>{text}</p>
    <div>
      <Link className={primaryClassName} href={'/register?next=' + target} onClick={() => trackFunnel('signup_prompt_click', next)}>{cta}</Link>
      {showLogin && <Link className={secondaryClassName} href={'/login?next=' + target} onClick={() => trackFunnel('signup_prompt_click', next)}>تسجيل الدخول</Link>}
    </div>
  </section>;
}
