import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPrelaunchSecurityDatabase,securityUsers as U} from './helpers/prelaunchSecurityDatabase.mjs';
import {authorizeEditorRequest} from '../lib/adminAuthorization.js';
import {handleContactRequest,contactRateKey} from '../lib/contactService.js';
import {MESSAGE_STATUSES,messageStatus,messageContext} from '../lib/contactMessages.js';
import {contactSubmissionIdentity} from '../lib/contactSubmission.js';

const payload={name:'مستخدم اختبار',email:'test@example.test',type:'استفسار',message:'رسالة اختبار محلية صالحة للتحقق من حفظ الرسائل.'};
const req=(data=payload,headers={})=>new Request('https://example.test/api/contact',{method:'POST',headers:{'Content-Type':'application/json',origin:'https://example.test',...headers},body:JSON.stringify(data)});

test('L-05/L-06/L-07/S-02/S-04: production SQL in isolated '+(process.env.TEST_SECURITY_POSTGRES_ADMIN_URL?'real PostgreSQL':'PGlite')+' (sequential; separate concurrency suite)',async t=>{
 const db=await createPrelaunchSecurityDatabase();t.after(()=>db.close());
 const work=randomUUID(),message=randomUUID(),section=randomUUID(),domain=randomUUID(),indicator=randomUUID(),source=randomUUID();
 await db.pg.query("insert into public.works(id,slug,title,external_url,is_published) values($1,'security-fixture','عنوان اختبار','https://example.test',false)",[work]);
 await db.pg.query("insert into public.messages(id,name,email,type,message) values($1,'قديم','old@example.test','استفسار','رسالة قديمة دون أعمدة متابعة')",[message]);
 await db.pg.query("insert into public.stat_sections(id,slug,name,is_published) values($1,'private-section','قسم اختبار',false)",[section]);
 await db.pg.query("insert into public.stat_domains(id,section_id,slug,name,is_published) values($1,$2,'child-domain','مجال اختبار',true)",[domain,section]);
 await db.pg.query("insert into public.stat_sources(id,name,is_active) values($1,'مصدر اختبار',true)",[source]);
 await db.pg.query("insert into public.stat_indicators(id,domain_id,slug,name,unit,data_status,is_published) values($1,$2,'child-indicator','مؤشر اختبار','نسبة','complete',true)",[indicator,domain]);
 await db.pg.query('insert into public.stat_values(indicator_id,source_id,year,value,is_published) values($1,$2,2026,1,true)',[indicator,source]);
 await db.pg.query('insert into public.stat_indicator_sources(indicator_id,source_id) values($1,$2)',[indicator,source]);
 await t.test('L-06 reproduces legacy anon policy failure and withdrawn-parent child visibility',async()=>{
  await assert.rejects(db.run(null,'select * from public.works'),e=>e.code==='42501');
  assert.equal((await db.run(null,'select * from public.stat_domains')).rows.length,1);
 });
 await db.migrate();
 await t.test('L-06 additive migrations are repeatable and preserve existing message content',async()=>{
  await db.migrate();
  const row=(await db.pg.query('select * from public.messages where id=$1',[message])).rows[0];assert.equal(row.status,'new');assert.equal(row.message,'رسالة قديمة دون أعمدة متابعة');
 });
 await db.pg.query('delete from public.editors where user_id=$1',[U.revoked]);
 await t.test('L-05 visitor/regular/unconfirmed/banned/revoked cannot read drafts, edit, moderate, upload or manage tasks',async()=>{
  for(const user of [null,U.regular,U.unconfirmed,U.suspended,U.revoked]){
   assert.equal((await db.run(user,'select * from public.works')).rows.length,0);
   if(user){assert.equal((await db.run(user,'select * from public.messages')).rows.length,0);assert.equal((await db.run(user,"update public.works set title='تجاوز' where id=$1 returning id",[work])).rows.length,0);}
   else {await assert.rejects(db.run(user,'select * from public.messages'),e=>e.code==='42501');await assert.rejects(db.run(user,"update public.works set title='تجاوز' where id=$1 returning id",[work]),e=>e.code==='42501');}
   await assert.rejects(db.run(user,"insert into storage.objects(bucket_id,name) values('media','forbidden.pdf')"));
   await assert.rejects(db.run(user,"select public.task_mutate('create',null,null,'{\"title\":\"تجاوز\"}')"));
   await assert.rejects(db.run(user,"select public.debate_admin_mutate('save',null,null,'{}')"));
  }
 });
 await t.test('L-05 API authorization independently denies invalid roles, confirmation and bans',async()=>{
  for(const name of ['regular','unconfirmed','suspended','revoked','admin','manager']){
   const user=(await db.pg.query('select * from auth.users where id=$1',[U[name]])).rows[0];
   const client={auth:{getUser:async()=>({data:{user},error:null})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:(await db.pg.query('select role from public.editors where user_id=$1',[user.id])).rows[0]||null,error:null})})})})};
   const request=new Request('https://example.test/api/admin/editors',{headers:{authorization:'Bearer local-fixture',origin:'https://example.test'}});
   if(['admin','manager'].includes(name))assert.ok(await authorizeEditorRequest(request,client));
   else await assert.rejects(authorizeEditorRequest(request,client),e=>e.status===403);
  }
  await assert.rejects(authorizeEditorRequest(new Request('https://example.test/api/admin/editors'),{}),e=>e.status===401);
 });
 await t.test('L-05 admin reads drafts/uploads/edits but only management deletes; role self-assignment is refused',async()=>{
  assert.equal((await db.run(U.admin,'select * from public.works')).rows.length,1);
  assert.equal((await db.run(U.admin,"update public.works set title='تحديث محلي' where id=$1 returning id",[work])).rows.length,1);
  assert.equal((await db.run(U.admin,'delete from public.works where id=$1 returning id',[work])).rows.length,0);
  assert.equal((await db.run(U.admin,"insert into storage.objects(bucket_id,name) values('media','public-test.pdf') returning id")).rows.length,1);
  await assert.rejects(db.run(U.regular,"insert into public.editors(user_id,role) values($1,'management')",[U.regular]));
  assert.equal((await db.run(U.manager,'delete from public.works where id=$1 returning id',[work])).rows.length,1);
 });
 await t.test('L-06 public REST-equivalent RLS follows parent publication and active source',async()=>{
  for(const table of ['stat_domains','stat_indicators','stat_values','stat_indicator_sources'])assert.equal((await db.run(null,'select * from public.'+table)).rows.length,0);
  await db.pg.query('update public.stat_sections set is_published=true where id=$1',[section]);
  assert.equal((await db.run(null,'select * from public.stat_values')).rows.length,1);
  await db.pg.query('update public.stat_sources set is_active=false where id=$1',[source]);
  assert.equal((await db.run(null,'select * from public.stat_values')).rows.length,0);
  assert.equal((await db.run(U.regular,'select * from public.stat_indicator_sources')).rows.length,0);
  assert.equal((await db.run(U.admin,'select * from public.stat_values')).rows.length,1);
 });
 await t.test('L-07 only active editors update status; sender/body columns remain read-only',async()=>{
  for(const status of Object.keys(MESSAGE_STATUSES)){
   const row=(await db.run(U.admin,'update public.messages set status=$1 where id=$2 returning *',[status,message])).rows[0];assert.equal(row.status,status);
  }
  for(const user of [U.regular,U.unconfirmed,U.suspended,U.revoked])assert.equal((await db.run(user,"update public.messages set status='new' where id=$1 returning *",[message])).rows.length,0);
  await assert.rejects(db.run(U.admin,"update public.messages set email='override@example.test' where id=$1",[message]),e=>e.code==='42501');
  await assert.rejects(db.run(U.admin,"update public.messages set status='unknown' where id=$1",[message]),e=>e.code==='23514');
  assert.equal(messageStatus({}), 'new');
  assert.equal(messageContext('رسالة قديمة').reference,null);
  assert.equal(messageContext('مرجع الطلب: محلي\nصفحة المرجع: //evil.test\n\nنص').reference,null);
  const context=messageContext('مرجع الطلب: محلي\nصفحة المرجع: /works/test\nمعرّف المرجع: one\n\nفقرة أولى\n\nفقرة ثانية');
  assert.equal(context.reference.path,'/works/test');assert.equal(context.body,'فقرة أولى\n\nفقرة ثانية');
 });
 await t.test('S-02 atomic guard blocks last-manager demotion/deletion and rolls back mixed bulk removal',async()=>{
  await db.pg.query("update public.editors set role='admin' where user_id=$1",[U.manager2]);
  await assert.rejects(db.pg.query('delete from public.editors where user_id=$1',[U.manager]),e=>e.code==='23514');
  await assert.rejects(db.pg.query("update public.editors set role='admin' where user_id=$1",[U.manager]),e=>e.code==='23514');
  await db.pg.query("update public.editors set role='management' where user_id=$1",[U.manager2]);
  await db.pg.query("insert into public.editors(user_id,role) values($1,'management') on conflict(user_id) do update set role=excluded.role",[U.manager2]);
  await assert.rejects(db.pg.query("delete from public.editors where role='management'"),e=>e.code==='23514');
  assert.equal((await db.pg.query('select manager_count from public.management_guard')).rows[0].manager_count,2);
 });
 await t.test('S-04 shared PostgreSQL limiter enforces eight, hides rows/RPC, cleans expired hashes',async()=>{
  const key='a'.repeat(64);
  for(let i=0;i<10;i++)assert.equal((await db.run(null,'select public.contact_rate_limit($1) allowed',[key],'service_role')).rows[0].allowed,i<8);
  for(const role of ['anon','authenticated']){
   await assert.rejects(db.run(U.regular,'select * from public.contact_rate_limits',[],role));
   await assert.rejects(db.run(U.regular,'select public.contact_rate_limit($1)',[key],role));
  }
  await db.pg.exec("update public.contact_rate_limits set expires_at=now()-interval '1 second'");
  assert.equal((await db.run(null,'select public.contact_rate_limit($1) allowed',['b'.repeat(64)],'service_role')).rows[0].allowed,true);
  assert.equal((await db.pg.query('select count(*)::int n from public.contact_rate_limits')).rows[0].n,1);
 });
});

test('S-04 HMAC rate identity ignores spoofable forwarding headers and stores no raw IP',()=>{
 const env={VERCEL:'1',CONTACT_RATE_LIMIT_SECRET:'local-test-key'};
 const a=contactRateKey(req(payload,{'x-vercel-forwarded-for':'192.0.2.1'}),env);
 assert.match(a,/^[a-f0-9]{64}$/);assert.ok(!a.includes('192.0.2.1'));
 assert.notEqual(a,contactRateKey(req(payload,{'x-vercel-forwarded-for':'192.0.2.2'}),env));
 assert.equal(contactRateKey(req(payload,{'x-forwarded-for':'192.0.2.1'}),env),contactRateKey(req(payload,{'x-forwarded-for':'192.0.2.2'}),env));
 // Behind Coolify the proxy sets X-Real-IP / X-Forwarded-For: each visitor gets their own bucket,
 // and a signed-in sender is keyed by account.
 const coolify={CONTACT_RATE_LIMIT_SECRET:'local-test-key'};
 assert.notEqual(contactRateKey(req(payload,{'x-real-ip':'192.0.2.1'}),coolify),contactRateKey(req(payload,{'x-real-ip':'192.0.2.2'}),coolify));
 assert.ok(!contactRateKey(req(payload,{'x-real-ip':'192.0.2.1'}),coolify).includes('192.0.2.1'));
 assert.equal(contactRateKey(req(payload,{'x-real-ip':'not-an-ip'}),coolify),contactRateKey(req(payload),coolify),'junk falls back to the shared bucket');
 assert.notEqual(contactRateKey(req(payload,{'x-real-ip':'192.0.2.1'}),coolify,'user-a'),contactRateKey(req(payload,{'x-real-ip':'192.0.2.1'}),coolify,'user-b'));
});

test('L-07 ambiguous committed response reuses identity only for unchanged message; edits get a new identity',()=>{
 let next=0;const id=()=>String(++next),first=contactSubmissionIdentity(null,payload,id);
 assert.equal(contactSubmissionIdentity(first,{...payload,'cf-turnstile-response':'fresh-challenge'},id),first);
 for(const key of ['name','email','type','message','referencePath'])assert.notEqual(contactSubmissionIdentity(first,{...payload,[key]:'edited'},id).id,first.id);
 assert.equal(first.id,'1');
});

test('L-07/S-04 contact handler validates, saves before confirmation, preserves references and handles errors',async()=>{
 let saved=null,rate=true,saveError=null,rateError=null;
 const db={rpc:async()=>({data:rate,error:rateError}),from:table=>{assert.equal(table,'messages');return {insert:async data=>{saved=data;return {error:saveError};}};}};
 const options={createDb:()=>db,env:{CONTACT_RATE_LIMIT_SECRET:'local-test-only'},log:()=>{}};
 assert.equal((await handleContactRequest(req({...payload,referenceTitle:'شركة اختبار',referencePath:'/yemeni-products/test',referenceId:'local-id'}),options)).status,201);
 assert.match(saved.message,/مرجع الطلب: شركة اختبار/);assert.match(saved.message,/local-id/);
 saveError={code:'offline',message:'private-details'};const error=await handleContactRequest(req(),options);assert.equal(error.status,503);assert.ok(!(await error.text()).includes('private-details'));
 saveError={code:'23505'};assert.equal((await handleContactRequest(req({...payload,submissionId:randomUUID()}),options)).status,201);
 saveError=null;rate=false;const limited=await handleContactRequest(req(),options);assert.equal(limited.status,429);assert.equal(limited.headers.get('Retry-After'),'600');
 rateError={code:'42883'};assert.equal((await handleContactRequest(req(),options)).status,503);rateError=null;rate=true;
 assert.equal((await handleContactRequest(req({...payload,message:'قصير'}),options)).status,400);
 assert.equal((await handleContactRequest(req(payload,{origin:'https://evil.test'}),options)).status,403);
 assert.equal((await handleContactRequest(req(),{...options,createDb:()=>null})).status,503);
 for(const result of [{success:false},{success:true,hostname:'evil.test',action:'contact'},{success:true,hostname:'example.test',action:'other'},{success:true,hostname:'example.test',action:'contact'}]){
  const response=await handleContactRequest(req({...payload,'cf-turnstile-response':'local-captcha-token'}),{...options,env:{...options.env,TURNSTILE_SECRET_KEY:'test-secret',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'test-site'},fetchImpl:async()=>Response.json(result)});
  assert.equal(response.status,result.success&&result.hostname==='example.test'&&result.action==='contact'?201:400);
 }
});
