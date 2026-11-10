// Guest lessons in مدرسة 967. A visitor may take the first GUEST_LESSONS lessons of every
// course without an account; they are graded in the browser and kept in localStorage with the
// answers given. After the visitor signs in, each finished lesson is replayed through the
// normal member API (start, check every card with the same answers, submit), so the server
// grades it again and nothing the browser claims is trusted.
export const GUEST_LESSONS = 3;
export const GUEST_PREFIX = '967-school-v2:';
export const guestLessonKey = (slug, index) => GUEST_PREFIX + slug + ':' + index;
export const guestLessonOpen = index => Number.isInteger(index) && index >= 0 && index < GUEST_LESSONS;

// Keeps at most two answers per card: the server allows two tries before revealing the answer.
export function recordGuestAnswer(record, cardId, answer) {
  const answers = {...(record?.answers || {})};
  answers[cardId] = [...(answers[cardId] || []), answer].slice(0, 2);
  return {...(record || {}), answers};
}

// Every finished guest lesson in this browser: [{slug, index, stars, cards, answers}], in course order.
export function finishedGuestLessons(storage) {
  const out = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      const match = key && key.startsWith(GUEST_PREFIX) ? key.slice(GUEST_PREFIX.length).match(/^([a-z][a-z0-9-]{2,39}):(\d{1,2})$/) : null;
      if (!match || !guestLessonOpen(Number(match[2]))) continue;
      let record = null;
      try { record = JSON.parse(storage.getItem(key) || 'null'); } catch { record = null; }
      if (record?.finished && record.answers && typeof record.answers === 'object')
        out.push({slug: match[1], index: Number(match[2]), stars: Number(record.stars) || 0, cards: record.cards || {}, answers: record.answers});
    }
  } catch { return out; }
  return out.sort((a, b) => a.slug.localeCompare(b.slug) || a.index - b.index);
}

// Stars per lesson index for one course, for the journey map of a guest.
export function guestCourseProgress(storage, slug) {
  return Object.fromEntries(finishedGuestLessons(storage).filter(item => item.slug === slug).map(item => [item.index, {stars: Math.max(1, Math.min(3, item.stars || 1))}]));
}
