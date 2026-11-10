import 'server-only';
import {RequestValidationError} from './requestSecurity.js';

// Narrow permissions given to existing members by email (price reporters, guide editors):
// a table of user ids that management adds to or removes from. No other access comes with it.
export const ACCESS_TABLES = new Set(['exchange_rate_reporters', 'transaction_guide_editors']);
const missingTable = error => ['42P01', 'PGRST205'].includes(error?.code);
const checkTable = table => { if (!ACCESS_TABLES.has(table)) throw Error('unknown access table'); };

export async function hasAccess(db, table, userId) {
  checkTable(table);
  const {data, error} = await db.from(table).select('user_id').eq('user_id', userId).maybeSingle();
  if (error && !missingTable(error)) throw new RequestValidationError('تعذر التحقق من الصلاحيات.', 503);
  return Boolean(data);
}

export async function listAccess(db, table) {
  checkTable(table);
  const {data, error} = await db.from(table).select('user_id,created_at').order('created_at');
  if (error) throw missingTable(error) ? new RequestValidationError('جدول الصلاحيات غير مُنشأ بعد.', 503) : Error('access list');
  return Promise.all((data || []).map(async row => {
    const {data: found} = await db.auth.admin.getUserById(row.user_id);
    return {userId: row.user_id, email: found?.user?.email || '', name: found?.user?.user_metadata?.full_name || found?.user?.user_metadata?.display_name || '', created_at: row.created_at};
  }));
}

async function findUserByEmail(db, email) {
  for (let page = 1; page <= 20; page++) {
    const {data, error} = await db.auth.admin.listUsers({page, perPage: 1000});
    if (error) throw Error('تعذر البحث عن الحساب.');
    const found = data.users.find(user => user.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  return null;
}

export async function addAccess(db, table, {email, actorId}) {
  checkTable(table);
  const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!/^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(address)) throw new RequestValidationError('أدخل بريدًا إلكترونيًا صحيحًا.');
  const user = await findUserByEmail(db, address);
  if (!user) throw new RequestValidationError('لا يوجد حساب بهذا البريد. اطلب من الشخص إنشاء حساب في الموقع أولًا.', 404);
  if (!user.email_confirmed_at) throw new RequestValidationError('هذا الحساب لم يؤكد بريده بعد.');
  const {error} = await db.from(table).upsert({user_id: user.id, added_by: actorId}, {onConflict: 'user_id'});
  if (error) throw Error('تعذر إضافة الحساب.');
  return {userId: user.id};
}

export async function removeAccess(db, table, {userId}) {
  checkTable(table);
  if (typeof userId !== 'string' || !/^[0-9a-f-]{36}$/i.test(userId)) throw new RequestValidationError('معرّف الحساب غير صالح.');
  const {error} = await db.from(table).delete().eq('user_id', userId);
  if (error) throw Error('تعذر إزالة الحساب.');
  return {removed: true};
}
