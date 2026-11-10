'use client';
import {useEffect, useState} from 'react';
import {CheckCircle2} from 'lucide-react';
import {countOf} from '@/lib/arabicCount';
import {currentSession} from '@/lib/browserSession';
import {finishedGuestLessons, guestLessonKey} from '@/lib/schoolGuest';

// After a visitor signs in, moves the lessons they finished as a guest into their account.
// Each lesson is replayed through the member API with the answers saved in the browser
// (start → check every card → submit), so the server grades it again. Lessons the account
// already finished are skipped; a lesson the server refuses (for example, an earlier lesson is
// not done yet) stays in the browser and is tried again on a later visit.
let running = false;

async function post(token, body) {
  const response = await fetch('/api/school/custom', {method: 'POST', headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(json.error || 'school');
  return json;
}

export async function claimGuestLessons(token, storage = localStorage) {
  const lessons = finishedGuestLessons(storage);
  const courses = new Map();
  let moved = 0;
  for (const item of lessons) {
    try {
      if (!courses.has(item.slug)) {
        const response = await fetch('/api/school/custom?slug=' + encodeURIComponent(item.slug), {cache: 'no-store', headers: {Authorization: 'Bearer ' + token}});
        const json = await response.json().catch(() => ({}));
        courses.set(item.slug, response.ok ? new Map((json.stages || []).map(stage => [stage.index, stage])) : null);
      }
      const stages = courses.get(item.slug);
      if (!stages) continue;
      if (stages.get(item.index)?.completed) { storage.removeItem(guestLessonKey(item.slug, item.index)); continue; }
      const {attempt} = await post(token, {action: 'start', slug: item.slug, stage: item.index});
      if (!attempt?.id) continue;
      for (const [cardId, answers] of Object.entries(item.answers)) {
        if (attempt.cards?.[cardId]?.done) continue;
        for (const answer of answers) {
          const outcome = await post(token, {action: 'check', slug: item.slug, attemptId: attempt.id, cardId, answer});
          if (outcome.done) break;
        }
      }
      await post(token, {action: 'submit', slug: item.slug, attemptId: attempt.id});
      storage.removeItem(guestLessonKey(item.slug, item.index));
      stages.set(item.index, {...stages.get(item.index), completed: true});
      moved++;
    } catch { /* kept in the browser; tried again on the next visit */ }
  }
  return moved;
}

export default function GuestProgressClaim({onClaimed}) {
  const [moved, setMoved] = useState(0);
  useEffect(() => {
    let alive = true;
    (async () => {
      let pending = [];
      try { pending = finishedGuestLessons(localStorage); } catch { return; }
      if (!pending.length || running) return;
      const session = await currentSession();
      if (!session?.access_token || !alive) return;
      running = true;
      try {
        const count = await claimGuestLessons(session.access_token);
        if (count && alive) { setMoved(count); onClaimed?.(); window.dispatchEvent(new Event('967:school-progress')); }
      } finally { running = false; }
    })();
    return () => { alive = false; };
  }, [onClaimed]);
  if (!moved) return null;
  return <p role="status" style={{display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 0', padding: '10px 14px', borderRadius: 14, background: 'var(--c-accent-soft,#dcefe9)', fontSize: 14, lineHeight: 1.7}}>
    <CheckCircle2 size={18} aria-hidden="true"/> نقلنا {moved === 1 ? 'درسًا واحدًا أنجزته كزائر إلى حسابك، وأُضيفت نجومه ونقاطه' : moved === 2 ? 'درسين أنجزتهما كزائر إلى حسابك، وأُضيفت نجومهما ونقاطهما' : countOf(moved, 'lesson') + ' أنجزتها كزائر إلى حسابك، وأُضيفت نجومها ونقاطها'}.
  </p>;
}
