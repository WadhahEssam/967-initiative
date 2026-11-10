import {isSameOrigin,RequestValidationError} from './requestSecurity.js';

// Verify the server-side session and role; never trust a role supplied by the UI.
// allowMember: a confirmed, signed-in member who is not an editor gets {role:null} instead of a 403.
export async function authorizeEditorRequest(request,db,{allowMember=false}={}){
 if(!isSameOrigin(request))throw new RequestValidationError('طلب غير مسموح.',403);
 const token=request.headers.get('authorization')?.match(/^Bearer\s+([^\s]{1,8000})$/i)?.[1];
 if(!token)throw new RequestValidationError('سجّل الدخول بحساب تحرير أولًا.',401);
 if(!db)throw new RequestValidationError('خدمة الإدارة غير مفعّلة.',503);
 let userResult;
 try{userResult=await db.auth.getUser(token);}catch{throw new RequestValidationError('تعذر التحقق من الجلسة.',503);}
 if(userResult.error||!userResult.data?.user)throw new RequestValidationError('تعذر التحقق من الجلسة. سجّل الدخول مجددًا.',userResult.error?.status>=500?503:401);
 if(!userResult.data.user.email_confirmed_at)throw new RequestValidationError('أكد بريدك الإلكتروني قبل دخول الإدارة.',403);
 if(userResult.data.user.banned_until&&new Date(userResult.data.user.banned_until).getTime()>Date.now())throw new RequestValidationError('هذا الحساب موقوف. تواصل مع الإدارة.',403);
 let editor;try{editor=await db.from('editors').select('role').eq('user_id',userResult.data.user.id).maybeSingle();}catch{throw new RequestValidationError('تعذر التحقق من الصلاحيات.',503);}
 if(editor.error)throw new RequestValidationError('تعذر التحقق من الصلاحيات.',503);
 if(allowMember&&!['admin','management'].includes(editor.data?.role))return {user:userResult.data.user,role:null};
 if(!['admin','management'].includes(editor.data?.role))throw new RequestValidationError('هذه العملية متاحة للمحررين المعتمدين فقط.',403);
 return {user:userResult.data.user,role:editor.data.role};
}

// Use for every role-changing endpoint (including assigning an existing email).
// 202610230002_management_guard.sql provides the authoritative atomic DB guard.
export async function checkRoleChange(db, userId, nextRole, actorId) {
  if (typeof userId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)) throw new RequestValidationError('معرّف الحساب غير صالح.');
  const {data: current, error} = await db.from('editors').select('role').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (current?.role === 'management' && nextRole !== 'management') {
    if (userId === actorId) throw new RequestValidationError('لا يمكنك إزالة صلاحية الإدارة من حسابك الحالي.');
    const result = await db.from('editors').select('*', {count: 'exact', head: true}).eq('role', 'management');
    if (result.error) throw result.error;
    if ((result.count || 0) <= 1) throw new RequestValidationError('لا يمكن إزالة صلاحية آخر حساب إدارة.');
  }
  return current;
}
