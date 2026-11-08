// ذاكرة مؤقتة داخل عملية الخادم لقراءات Supabase الثقيلة المتكررة (المؤشرات، الأقسام، الإعدادات).
// السبب: كل زيارة كانت تعيد قراءة البيانات نفسها من Supabase (نحو 4 ميجابايت لكل قراءة كاملة للمؤشرات)،
// فاستُنفد حد «Egress» الشهري وتباطأت القاعدة. الآن تُقرأ مرة كل ttlMs على الأكثر مهما كثرت الزيارات.
// - الطلبات المتزامنة تنتظر قراءة واحدة بدل أن تطلق كل منها قراءة.
// - إذا فشلت القراءة تُستعمل آخر قيمة ناجحة ما دام عمرها أقل من staleMs.
export function createMemo({ttlMs, staleMs = 0, now = () => Date.now()}) {
  let entry = null, inflight = null;
  const memo = async load => {
    if (entry && now() - entry.at < ttlMs) return entry.value;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        const value = await load();
        entry = {value, at: now()};
        return value;
      } catch (error) {
        if (entry && now() - entry.at < staleMs) return entry.value;
        throw error;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };
  memo.clear = () => { entry = null; };
  return memo;
}

// Like createMemo, but when checkMs has passed it first asks for a cheap version (for example the
// rows' updated_at values) and reloads the full value only when that version changed.
// - maxAgeMs: reload fully at least this often anyway, in case a writer did not touch the version.
// - staleMs: if checking or loading fails, keep serving the last value verified within staleMs.
// memo({version, load}): version() returns a string; load() returns {value, version}.
export function createVersionedMemo({checkMs, maxAgeMs = Infinity, staleMs = 0, now = () => Date.now()}) {
  let entry = null, inflight = null;
  const memo = async ({version, load}) => {
    if (entry && now() - entry.checkedAt < checkMs) return entry.value;
    if (inflight) return inflight;
    inflight = (async () => {
      try {
        if (entry && now() - entry.loadedAt < maxAgeMs && await version() === entry.version) {
          entry = {...entry, checkedAt: now(), verifiedAt: now()};
          return entry.value;
        }
        const loaded = await load();
        const at = now();
        entry = {value: loaded.value, version: loaded.version, checkedAt: at, verifiedAt: at, loadedAt: at};
        return entry.value;
      } catch (error) {
        if (entry && now() - entry.verifiedAt < staleMs) { entry = {...entry, checkedAt: now()}; return entry.value; }
        throw error;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };
  memo.clear = () => { entry = null; };
  return memo;
}

// Version string for a set of site_settings rows: changes when any row is added, removed or saved.
export function settingsRowsVersion(rows) {
  return (rows || []).map(row => row.key + '@' + (row.updated_at || '')).sort().join('|');
}
