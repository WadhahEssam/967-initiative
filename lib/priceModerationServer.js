import 'server-only';
import {authorizeEditorRequest} from './adminAuthorization.js';
import {RequestValidationError} from './requestSecurity.js';
import {recordOperationalEvent} from './operationalEvents.js';
import {getPriceBoard,instrumentKey,logPriceAction,recomputePrices} from './priceConsensusServer.js';
import {ALERT_LABELS} from './priceAlerts.js';
import {describeInstrument} from './priceReports.js';
import {BAN_BELOW} from './priceReputation.js';

// «المُبلّغ المحلي», the editors' side: alerts, held reports to accept or reject, reporters (search,
// verified anchors, silent bans), recomputing a price, and the log of every editor action.
// Editors (admin and management) only. Members never reach any of this.

const missingTable=error=>['42P01','PGRST205','42703'].includes(error?.code);
const read=({data,error})=>{if(missingTable(error))throw new RequestValidationError('جداول البلاغات غير مُنشأة بعد.',503);if(error){recordOperationalEvent('database_failure',{source:'prices'});throw new RequestValidationError('تعذر تحميل بيانات البلاغات.',503);}return data||[];};
const REPORTER='user_id,score,reports_total,reports_agreeing,silent_ban,ban_reason,banned_at,anchor,anchor_name,jumps_first,updated_at';
const isUuid=value=>typeof value==='string'&&/^[0-9a-f-]{36}$/i.test(value);
const pct=(value,price)=>price>0?Math.round((value-price)/price*1000)/10:null;

export const authorizePriceEditor=(request,db)=>authorizeEditorRequest(request,db);

async function namesOf(db,ids){
 const unique=[...new Set(ids.filter(Boolean))],names=new Map();
 for(let index=0;index<unique.length;index+=200){
  for(const row of read(await db.from('public_profiles').select('user_id,display_name').in('user_id',unique.slice(index,index+200))))names.set(row.user_id,row.display_name);
 }
 return names;
}
const reporterView=(row,names)=>row&&({userId:row.user_id,name:names.get(row.user_id)||'—',score:Number(row.score),reports:row.reports_total,agreeing:row.reports_agreeing,agreeingShare:row.reports_total?Math.round(row.reports_agreeing/row.reports_total*100):null,banned:row.silent_ban,banReason:row.ban_reason,anchor:row.anchor,anchorName:row.anchor_name||'',jumpsFirst:row.jumps_first});

export async function readPriceModeration(db){
 const since=new Date(Date.now()-48*3600e3).toISOString();
 const [alerts,held,anchors,banned,log,board]=await Promise.all([
  db.from('price_alerts').select('id,alert_type,kind,region,item,side,reporter_id,details,created_at').is('resolved_at',null).order('created_at',{ascending:false}).limit(100).then(read),
  db.from('price_reports').select('id,user_id,kind,region,item,side,value,confirmation,source,status,created_at').in('status',['held','outlier']).is('review',null).gte('created_at',since).order('created_at',{ascending:false}).limit(200).then(read),
  db.from('price_reporters').select(REPORTER).eq('anchor',true).order('updated_at',{ascending:false}).limit(200).then(read),
  db.from('price_reporters').select(REPORTER).eq('silent_ban',true).order('banned_at',{ascending:false}).limit(100).then(read),
  db.from('price_moderation_log').select('id,actor_id,action,target,note,created_at').order('created_at',{ascending:false}).limit(40).then(read),
  getPriceBoard(db).catch(()=>null),
 ]);
 const heldUsers=[...new Set(held.map(row=>row.user_id).filter(Boolean))];
 const scores=new Map();
 for(let index=0;index<heldUsers.length;index+=200)for(const row of read(await db.from('price_reporters').select('user_id,score,silent_ban,anchor').in('user_id',heldUsers.slice(index,index+200))))scores.set(row.user_id,row);
 const names=await namesOf(db,[...heldUsers,...anchors.map(row=>row.user_id),...banned.map(row=>row.user_id),...alerts.map(row=>row.reporter_id),...log.map(row=>row.actor_id)]);
 return {
  alerts:alerts.map(row=>({id:row.id,type:row.alert_type,label:ALERT_LABELS[row.alert_type]||row.alert_type,what:row.kind?describeInstrument(row):'',reporter:row.reporter_id?names.get(row.reporter_id)||'—':null,reporterId:row.reporter_id,details:row.details,createdAt:row.created_at})),
  held:held.map(row=>{const price=board?.[instrumentKey(row)]?.value??null,who=scores.get(row.user_id);return {id:row.id,what:describeInstrument(row),kind:row.kind,value:Number(row.value),price,gap:pct(Number(row.value),price),source:row.source||'',confirmation:row.confirmation,createdAt:row.created_at,userId:row.user_id,name:names.get(row.user_id)||'—',score:who?Number(who.score):30,banned:Boolean(who?.silent_ban),anchor:Boolean(who?.anchor)};}),
  anchors:anchors.map(row=>reporterView(row,names)),
  banned:banned.map(row=>reporterView(row,names)),
  log:log.map(row=>({id:row.id,actor:names.get(row.actor_id)||'—',action:row.action,target:row.target,note:row.note||'',createdAt:row.created_at})),
 };
}

// Find members by display name, or by exact email.
export async function searchReporters(db,query){
 const text=typeof query==='string'?query.trim().slice(0,80):'';
 if(text.length<2)throw new RequestValidationError('اكتب حرفين على الأقل.');
 let ids=[];
 if(text.includes('@')){
  for(let page=1;page<=20&&!ids.length;page++){
   const {data,error}=await db.auth.admin.listUsers({page,perPage:1000});
   if(error)throw new RequestValidationError('تعذر البحث عن الحساب.',503);
   const found=data.users.find(user=>user.email?.toLowerCase()===text.toLowerCase());
   if(found)ids=[found.id];
   if(data.users.length<1000)break;
  }
 }else{
  ids=read(await db.from('public_profiles').select('user_id').ilike('display_name','%'+text.replace(/[%_\\]/g,'\\$&')+'%').limit(20)).map(row=>row.user_id);
 }
 if(!ids.length)return {results:[]};
 const rows=new Map(read(await db.from('price_reporters').select(REPORTER).in('user_id',ids)).map(row=>[row.user_id,row]));
 const names=await namesOf(db,ids);
 return {results:ids.map(id=>reporterView(rows.get(id)||{user_id:id,score:30,reports_total:0,reports_agreeing:0,silent_ban:false,anchor:false,jumps_first:0},names))};
}

// One reporter: standing and their latest reports with how each was graded.
export async function readReporter(db,userId){
 if(!isUuid(userId))throw new RequestValidationError('معرّف الحساب غير صالح.');
 const [rows,reports,names]=await Promise.all([
  db.from('price_reporters').select(REPORTER).eq('user_id',userId).then(read),
  db.from('price_reports').select('id,kind,region,item,side,value,confirmation,source,status,review,agreement,score_delta,created_at').eq('user_id',userId).order('created_at',{ascending:false}).limit(30).then(read),
  namesOf(db,[userId]),
 ]);
 return {reporter:reporterView(rows[0]||{user_id:userId,score:30,reports_total:0,reports_agreeing:0,silent_ban:false,anchor:false,jumps_first:0},names),reports:reports.map(row=>({id:row.id,what:describeInstrument(row),value:Number(row.value),confirmation:row.confirmation,source:row.source||'',status:row.status,review:row.review,agreement:row.agreement,delta:row.score_delta===null?null:Number(row.score_delta),createdAt:row.created_at}))};
}

// Accept a held report (it counts), reject it (no weight), or clear the decision.
export async function reviewReport(db,{reportId,review,note,actorId}){
 if(!Number.isSafeInteger(reportId)||reportId<1)throw new RequestValidationError('معرّف البلاغ غير صالح.');
 if(![null,'accepted','rejected'].includes(review))throw new RequestValidationError('القرار غير معروف.');
 const [report]=read(await db.from('price_reports').select('id,kind,region,item,side,value,review').eq('id',reportId));
 if(!report)throw new RequestValidationError('لم يُعثر على البلاغ.',404);
 read(await db.from('price_reports').update({review,reviewed_by:review?actorId:null,reviewed_at:review?new Date().toISOString():null}).eq('id',reportId).select('id'));
 await logPriceAction(db,{actorId,action:review==='accepted'?'accept_report':review==='rejected'?'reject_report':'clear_review',target:'report:'+reportId+' ('+describeInstrument(report)+' = '+report.value+')',before:{review:report.review},after:{review},note});
 await recomputePrices(db,report.kind);
 return {ok:true};
}

// Silent ban / lift it; verify an anchor (a changer or trader) / remove it.
export async function updateReporter(db,{userId,action,anchorName,note,actorId}){
 if(!isUuid(userId))throw new RequestValidationError('معرّف الحساب غير صالح.');
 if(!['ban','unban','anchor_on','anchor_off'].includes(action))throw new RequestValidationError('الإجراء غير معروف.');
 const [before]=read(await db.from('price_reporters').select(REPORTER).eq('user_id',userId));
 const now=new Date().toISOString(),score=before?Number(before.score):30;
 const change=action==='ban'?{silent_ban:true,ban_reason:'editor',banned_at:now}
  // Lifting a ban brings the score back to the ban line, so the next graded report does not ban again at once.
  :action==='unban'?{silent_ban:false,ban_reason:null,banned_at:null,score:Math.max(score,BAN_BELOW)}
  :action==='anchor_on'?{anchor:true,anchor_name:typeof anchorName==='string'&&anchorName.trim()?anchorName.trim().slice(0,80):null,anchor_miss_streak:0}
  :{anchor:false,anchor_miss_streak:0};
 read(await db.from('price_reporters').upsert({user_id:userId,...change,updated_by:actorId,updated_at:now},{onConflict:'user_id'}).select('user_id'));
 const names=await namesOf(db,[userId]);
 await logPriceAction(db,{actorId,action,target:'reporter:'+userId+' ('+(names.get(userId)||'—')+')',before:before?{silent_ban:before.silent_ban,anchor:before.anchor,score}:null,after:change,note});
 await Promise.all([recomputePrices(db,'rate'),recomputePrices(db,'food')]);
 return {ok:true};
}

export async function resolveAlert(db,{alertId,note,actorId}){
 if(!Number.isSafeInteger(alertId)||alertId<1)throw new RequestValidationError('معرّف التنبيه غير صالح.');
 const rows=read(await db.from('price_alerts').update({resolved_at:new Date().toISOString(),resolved_by:actorId}).eq('id',alertId).is('resolved_at',null).select('id,alert_type,kind,region,item,side'));
 if(!rows.length)throw new RequestValidationError('التنبيه عولج من قبل.',409);
 await logPriceAction(db,{actorId,action:'resolve_alert',target:'alert:'+alertId+' ('+(ALERT_LABELS[rows[0].alert_type]||'')+(rows[0].kind?' · '+describeInstrument(rows[0]):'')+')',note});
 return {ok:true};
}

// Work the prices out again; «من البداية» starts from the editor entries instead of the stored prices.
export async function recomputeByEditor(db,{kind,reset,actorId}){
 if(!['rate','food'].includes(kind))throw new RequestValidationError('نوع الأسعار غير معروف.');
 const result=await recomputePrices(db,kind,{reset:reset===true});
 await logPriceAction(db,{actorId,action:'recompute',target:kind+(reset===true?' (from the anchors)':''),after:{changed:result?.changed??0}});
 return {ok:true,changed:result?.changed??0};
}
