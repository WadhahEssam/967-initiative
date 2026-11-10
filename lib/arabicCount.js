// Arabic number–noun agreement: «درس واحد»، «درسان»، «3 دروس»، «11 درسًا»، «100 درس».
// forms: {one, two, few (3–10, plural), many (11–99, accusative singular), hundred (100+ round, singular)}.
export function countLabel(value, {one, two, few, many, hundred = null}) {
  const n = Math.abs(Math.trunc(Number(value) || 0));
  if (n === 1) return one;
  if (n === 2) return two;
  const rest = n % 100;
  const word = rest >= 3 && rest <= 10 ? few : rest >= 11 || (rest === 0 && n === 0) ? many : rest === 1 || rest === 2 || rest === 0 ? (hundred || many) : many;
  return n + ' ' + word;
}
export const COUNT_FORMS = {
  lesson: {one: 'درس واحد', two: 'درسان', few: 'دروس', many: 'درسًا', hundred: 'درس'},
  star: {one: 'نجمة واحدة', two: 'نجمتان', few: 'نجوم', many: 'نجمة', hundred: 'نجمة'},
  day: {one: 'يوم واحد', two: 'يومان', few: 'أيام', many: 'يومًا', hundred: 'يوم'},
  source: {one: 'مصدر واحد', two: 'مصدران', few: 'مصادر', many: 'مصدرًا', hundred: 'مصدر'},
  player: {one: 'لاعب واحد', two: 'لاعبان', few: 'لاعبين', many: 'لاعبًا', hundred: 'لاعب'},
  challenge: {one: 'تحدٍّ واحد', two: 'تحدّيان', few: 'تحديات', many: 'تحديًا', hundred: 'تحدٍّ'},
  district: {one: 'مديرية واحدة', two: 'مديريتان', few: 'مديريات', many: 'مديرية', hundred: 'مديرية'},
  facility: {one: 'مرفق واحد', two: 'مرفقان', few: 'مرافق', many: 'مرفقًا', hundred: 'مرفق'},
  domain: {one: 'مجال واحد', two: 'مجالان', few: 'مجالات', many: 'مجالًا', hundred: 'مجال'},
  minute: {one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة', hundred: 'دقيقة'},
  station: {one: 'درس واحد', two: 'درسان', few: 'دروس', many: 'درسًا', hundred: 'درس'},
};
export const countOf = (value, kind) => countLabel(value, COUNT_FORMS[kind]);
