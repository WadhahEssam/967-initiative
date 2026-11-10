import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createInlineEditorTestDatabase,inlineTestUsers} from './helpers/inlineEditorTestDatabase.mjs';
import {seedDebateFixtures} from './helpers/debateFixtures.mjs';
import {handleInlineEditorRequest} from '../lib/inlineEditorApi.js';
import {handleDebateRequest} from '../lib/debateApi.js';

test('inline API: server sessions, validation, redaction and per-item review outcomes',async t=>{
 const db=await createInlineEditorTestDatabase();t.after(()=>db.close());const [A,B,M,U]=inlineTestUsers,f=await seedDebateFixtures(db);
 await f.update(f.recorded,{publication_status:'published',stage:'recording_available',recording_published:true});
 const api=async(user,query='view=session',body=null,options={})=>{
  const headers={...(user?{authorization:'Bearer '+user}:{}),...(body!==null?{'Content-Type':'application/json'}:{}),...options.headers};
  const request=new Request('http://localhost/api/admin/inline?'+query,{method:options.method||(body!==null?'POST':'GET'),headers,...(body!==null?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
  const response=await handleInlineEditorRequest(request,db.createDb);return {status:response.status,data:await response.json(),headers:response.headers};
 };
 const request=async(query,body=null,user=A.id)=>api(user,query,body);
 const ok=result=>{assert.equal(result.status,200,JSON.stringify(result));return result.data;};
 const seedComment=async(body='تعليق محلي ينتظر مراجعة داخل الصفحة')=>(await db.pg.query('insert into public.debate_comments(debate_id,user_id,body) values($1,$2,$3) returning id',[f.recorded,U.id,body])).rows[0].id;
 const getItem=async(kind,id)=>(ok(await request('view=item&kind='+kind+'&id='+id))).item;
 const moderate=async(kind,id,status,user=A.id,extra={})=>request('',{action:'moderate',kind,id,data:{status,updated_at:(await getItem(kind,id)).updated_at,reason:'مراجعة موثقة من الصفحة',...extra}},user);
 let c,c2,q;
 await t.test('session is verified on server, ordinary/forged/revoked roles and cross-origin requests denied',async()=>{
  assert.equal((await api(null)).status,401);assert.equal((await api('forged-token')).status,401);assert.equal((await api(U.id)).status,200);assert.deepEqual(ok(await api(U.id)).actor,null,'a member is told «not an editor», with no data');assert.equal((await api(U.id,'view=counts')).status,403);
  const state=ok(await api(A.id));assert.deepEqual(state.actor,{id:A.id,role:'admin'});
  assert.equal((await api(A.id,'view=session',null,{headers:{origin:'https://evil.invalid'}})).status,403);
  assert.equal((await api(A.id,'view=session',null,{headers:{'sec-fetch-site':'cross-site'}})).status,403);
  await db.pg.query('delete from public.editors where user_id=$1',[B.id]);assert.deepEqual(ok(await api(B.id)).actor,null);assert.equal((await api(B.id,'view=counts')).status,403);await db.pg.query("insert into public.editors(user_id,role) values($1,'admin')",[B.id]);
  const outage=await handleInlineEditorRequest(new Request('http://localhost/api/admin/inline',{headers:{authorization:'Bearer '+A.id}}),()=>null);assert.equal(outage.status,503);
 });
 await t.test('private no-store headers and bounded validated parameters apply on every response',async()=>{
  const result=await api(A.id);assert.match(result.headers.get('cache-control'),/no-store/);assert.match(result.headers.get('vary'),/Authorization/);assert.match(result.headers.get('x-robots-tag'),/noindex/);
  for(const query of ['view=invalid','view=counts&debate=bad','view=item&kind=users&id='+A.id,'view=queue&kind=all&page=0','view=queue&kind=all&page=10001','view=queue&kind=reports&comment=bad'])assert.equal((await request(query)).status,400,query);
  assert.equal((await api(A.id,'',null,{method:'PUT'})).status,405);
  assert.equal((await api(A.id,'','{',{headers:{'content-type':'text/plain'}})).status,415);
  assert.equal((await api(A.id,'','{')).status,400);
  assert.equal((await api(A.id,'','[]')).status,400);
  assert.equal((await api(A.id,'',{action:'task'},{headers:{'content-length':'180001'}})).status,413);
 });
 await t.test('queue is scoped and redacted, metadata supplies correct public link and item capabilities',async()=>{
  c=await seedComment();c2=await seedComment('تعليق ثان للمراجعة الجماعية');q=(await db.pg.query("insert into public.debate_questions(debate_id,user_id,body,anonymous) values($1,$2,'سؤال مجهول للتحقق من الخصوصية أثناء المراجعة',true) returning id",[f.recorded,U.id])).rows[0].id;
  const queue=ok(await request('view=queue&kind=all&debate='+f.recorded));assert.equal(queue.items.length,3);assert.equal(queue.total,3);
  const question=queue.items.find(x=>x.id===q);assert.equal(question.display_name,'مشارك');assert.equal(question.debate_slug,'local-prerecorded');assert.ok(question.debate_title);assert.equal(question.capabilities.account,false);assert.ok(!JSON.stringify(question).includes(U.id));
  assert.equal(ok(await request('view=queue&kind=all&debate='+f.live)).total,0);
  assert.equal((await api(U.id,'view=queue&kind=all&debate='+f.recorded)).status,403);assert.equal((await api(null,'view=item&kind=questions&id='+q)).status,401);
  const caps=ok(await request('view=capabilities&debate='+f.recorded)).capabilities;assert.deepEqual(caps.comments[c].statuses,['approved','rejected','hidden']);assert.equal(caps.questions[q].account,false);assert.equal((await api(U.id,'view=capabilities')).status,403);
 });
 await t.test('invalid fields, states, missing CAS and fake client roles never bypass real permissions',async()=>{
  assert.equal((await request('',{action:'moderate',kind:'comments',id:c,data:{status:'approved',reason:'أين نسخة العنصر؟'}})).status,400);
  assert.equal((await moderate('comments',c,'invalid')).status,400);
  assert.equal((await request('',{action:'delete',kind:'comments',id:c,role:'management',data:{updated_at:(await getItem('comments',c)).updated_at,reason:'دور مزيف من المتصفح',confirmed:true}})).status,403);
  assert.equal((await request('',{action:'pin',kind:'comments',id:c,data:{updated_at:(await getItem('comments',c)).updated_at,pinned:'true',reason:'قيمة غير منطقية'}})).status,400);
  assert.equal((await request('',{action:'moderate',kind:'comments',id:randomUUID(),data:{updated_at:new Date().toISOString(),status:'approved',reason:'عنصر مفقود'}})).status,404);
 });
 await t.test('batch is limited, requires confirmation and reports successful versus stale items individually',async()=>{
  const a=await getItem('comments',c),b=await getItem('comments',c2);await db.pg.query("update public.debate_comments set body='نص جديد راجعه قبل الاعتماد',updated_at=clock_timestamp() where id=$1",[c2]);
  const body={action:'batch',data:{items:[{kind:'comments',id:c,updated_at:a.updated_at},{kind:'comments',id:c2,updated_at:b.updated_at}],status:'approved',reason:'اعتماد دفعة مراجعة موثقة'}};
  assert.equal((await request('',body)).status,400);body.data.confirmed=true;
  const result=ok(await request('',body));assert.equal(result.succeeded,1);assert.equal(result.failed,1);assert.equal(result.results.find(x=>!x.ok).status,409);assert.equal((await getItem('comments',c)).status,'approved');assert.equal((await getItem('comments',c2)).status,'pending');
  assert.equal((await request('',{action:'batch',data:{...body.data,items:Array(21).fill(body.data.items[0])}})).status,400);
  assert.equal((await request('',{action:'batch',data:{...body.data,items:[body.data.items[0],body.data.items[0]]}})).status,400);
  assert.equal((await request('',{action:'batch',data:{...body.data,status:'deleted'}})).status,400);
 });
 await t.test('concurrent decisions on one revision permit one winner and preserve the final decision',async()=>{
  const current=await getItem('comments',c2);const payload=status=>({action:'moderate',kind:'comments',id:c2,data:{status,updated_at:current.updated_at,reason:'قرار متزامن خاضع لنسخة النص'}});
  const results=await Promise.all([request('',payload('approved')),request('',payload('rejected'),B.id)]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
  assert.ok(['approved','rejected'].includes((await getItem('comments',c2)).status));
 });
 await t.test('hide, real count update, history and undo work without exposing owner or private ballots',async()=>{
  const hidden=ok(await moderate('comments',c,'hidden'));assert.ok(hidden.undo_id);assert.equal(hidden.item.status,'hidden');
  const restored=ok(await request('',{action:'undo',id:hidden.undo_id}));assert.equal(restored.item.status,'approved');
  const history=ok(await request('view=history&kind=comments&id='+c));assert.ok(history.items.some(x=>x.action==='undo'));assert.ok(history.items.every(x=>!JSON.stringify(x).includes('user_id')));
  assert.equal((await request('',{action:'undo',id:hidden.undo_id})).status,409);
  const debate=ok(await request('view=debate&id='+f.recorded)).debate;assert.ok(debate.revision);assert.ok(debate.polls.length);assert.ok(!('votes' in debate));assert.ok(!('results' in debate));
 });
 await t.test('public target API resolves approved deep links and rejects invalid or unpublished targets without authentication',async()=>{
  const target=async(query)=>{const response=await handleDebateRequest(new Request('http://localhost/api/debates?'+query),db.createDb);return {status:response.status,data:await response.json()};};
  const result=ok(await target('target=comments&debate='+f.recorded+'&id='+c));assert.equal(result.item.id,c);assert.ok(result.page>=1);assert.ok(!('user_id' in result.item));
  assert.equal((await target('target=questions&debate='+f.recorded+'&id='+q)).data,null);
  assert.equal((await target('target=comments&debate='+f.live+'&id='+c)).data,null);
  assert.equal((await target('target=comments&debate='+f.recorded+'&id=invalid')).status,400);
  assert.equal((await target('target=comments&debate='+f.recorded+'&id='+c+'&order=invalid')).status,400);
 });
 await t.test('reports filter is applied before pagination, even with many unrelated older reports',async()=>{
  const unrelated=await seedComment('مشاركة تخص بلاغات أخرى');
  for(let i=0;i<24;i++){const reporter=randomUUID();await db.pg.query('insert into auth.users(id) values($1)',[reporter]);await db.pg.query('insert into public.debate_reports(comment_id,user_id,reason) values($1,$2,$3)',[unrelated,reporter,'بلاغ آخر غير متعلق بالعنصر الحالي']);}
  await db.pg.query('insert into public.debate_reports(comment_id,user_id,reason) values($1,$2,$3)',[c,U.id,'البلاغ المرتبط بالعنصر المطلوب']);
  const result=ok(await request('view=queue&kind=reports&status=all&comment='+c));assert.equal(result.total,1);assert.equal(result.items[0].comment_id,c);assert.equal(result.items.length,1);
 });
 await t.test('account details are minimal and management-only restrictions require account revision',async()=>{
  assert.equal((await request('view=account&kind=questions&id='+q)).status,403);
  const account=ok(await request('view=account&kind=comments&id='+c));assert.ok(!('user_id' in account));assert.equal(account.can_restrict,false);assert.ok(Array.isArray(account.actions));
  const body={action:'restrict',kind:'comments',id:c,data:{updated_at:account.updated_at,comments_restricted:true,reason:'تقييد موثق للمشاركة المخالفة'}};
  assert.equal((await request('',body)).status,403);const result=ok(await request('',body,M.id));assert.equal(result.comments_restricted,true);assert.equal(result.can_restrict,true);assert.ok(!JSON.stringify(result).includes(U.id));
  assert.equal((await request('',body,M.id)).status,409);
 });
 await t.test('content API validates protected fields, products and URLs and returns auditable CAS patch results',async()=>{
  const id=randomUUID();await db.pg.query("insert into public.yemeni_companies(id,slug,name,category,location,products,is_published) values($1,'api-company','شركة API','صناعة','عدن',$2,true)",[id,JSON.stringify([{name:'منتج',image_url:null,currency:'YER',unknown:'retain'}])]);
  const current=ok(await request('view=content&kind=company&id='+id));assert.equal(current.revision,1);
  const save=data=>request('',{action:'content_save',kind:'company',id,revision:1,data});
  assert.equal((await save({id:randomUUID()})).status,403);assert.equal((await save({is_published:'true'})).status,400);
  for(const products of [[{name:'منتج',image_url:'javascript:alert(1)'}],[{name:'',currency:'YER'}],[{name:'منتج',wholesale_price:-1}],[{name:'منتج',currency:'FAKE'}],[{name:'منتج',sources:[{title:'مصدر',url:'data:text/html,attack'}]}]])assert.equal((await save({products})).status,400,JSON.stringify(products));
  const saved=ok(await save({name:'شركة API بعد التحرير'}));assert.equal(saved.revision,2);assert.equal(saved.item.products[0].unknown,'retain');
  assert.equal((await save({name:'نسخة قديمة'})).status,409);assert.equal(ok(await request('view=content_history&kind=company&id='+id)).items.length,1);
  assert.equal((await api(U.id,'view=content&kind=company&id='+id)).status,403);
 });
 await t.test('task linkage is real, source is local and admin cannot assign another account',async()=>{
  const body={action:'task',data:{title:'مراجعة الصفحة الحالية',description:'تحقق من معلومات هذه الصفحة قبل النشر',source_type:'debate',source_id:f.recorded,source_url:'/debates/local-prerecorded'}};
  const saved=ok(await request('',body));assert.ok(saved.id);assert.equal((await db.pg.query('select source_id from public.tasks where id=$1',[saved.id])).rows[0].source_id,f.recorded);
  assert.equal((await request('',{...body,data:{...body.data,assigned_to:B.id}})).status,403);
  for(const source_url of ['//evil.invalid','/\\evil.invalid','https://evil.invalid'])assert.equal((await request('',{...body,data:{...body.data,source_url}})).status,400);
 });
});
