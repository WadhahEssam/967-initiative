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
