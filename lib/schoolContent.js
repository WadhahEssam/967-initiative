// Versioned editorial content and verified School assessments.
import {validSchoolScript} from './schoolCalligraphySamples.js';
import {GATE_TYPES,encodeMorse} from './schoolThinkingLabs.js';
import {SCIENCE_LABS} from './schoolScienceModels.js';
import {CIVIC_LABS} from './schoolCivicModels.js';
import {validateCivicActivity} from './schoolCivicActivities.js';
import {validateCardLesson,CARD_FORMAT} from './schoolCards.js';
// No course is built into the code any more: musnad and arud are card courses managed in the studio like the rest.
export const SCHOOL_FIXED_SLUGS=[];
export const SCHOOL_SLUG=/^[a-z][a-z0-9-]{2,39}$/;
const clean=(x,min,max)=>typeof x==='string'&&x.trim().length>=min&&x.trim().length<=max?x.trim():null;
export function normalizeArabicAnswer(value){
 return typeof value==='string'?value.normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'')
  .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/gu,' ').trim().toUpperCase():'';
}
export function validateSchoolEditorial(kind,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('بيانات التحرير غير صالحة.');
 if(kind==='course'){
  const title=clean(input.title,3,90),description=clean(input.description,10,700),category=clean(input.category,2,60);
  if(!title||!description||!category)throw Error('أضف اسم المسار وقسمه ووصفه.');
  const doc={title,description,category};
  // الإصدار الثاني: صيغة البطاقات، والوحدات، والمشروع الختامي (اختيارية).
  if(input.format!==undefined&&input.format!==null){if(input.format!==CARD_FORMAT)throw Error('صيغة المسار غير معروفة.');doc.format=CARD_FORMAT;}
  if(input.units!==undefined&&input.units!==null){
   if(!Array.isArray(input.units)||input.units.length<1||input.units.length>6)throw Error('من وحدة إلى ست وحدات.');
   const used=new Set();
   doc.units=input.units.map((u,i)=>{
    const name=clean(u?.title,2,60);
    if(!name||!Array.isArray(u.stages)||!u.stages.length||u.stages.some(n=>!Number.isInteger(n)||n<0||n>11||used.has(n)))throw Error('الوحدة '+(i+1)+': عنوان ومحطات من 1 إلى 12 بلا تكرار.');
    u.stages.forEach(n=>used.add(n));
    return {title:name,stages:[...u.stages].sort((a,b)=>a-b)};
   });
  }
  if(input.capstone!==undefined&&input.capstone!==null){
   if(!Number.isInteger(input.capstone)||input.capstone<0||input.capstone>11)throw Error('المشروع الختامي: محطة من 1 إلى 12.');
   doc.capstone=input.capstone;
  }
  return doc;
 }
 if(kind==='stage'&&input.format===CARD_FORMAT){
  // درس بطاقات كامل بمفاتيحه (المسودة والمنشور على الخادم فقط؛ المتصفح يتلقى الصيغة العامة).
  const raw=JSON.stringify(input);
  if(raw.length>60000)throw Error('الدرس أكبر من المسموح (60 ألف حرف).');
  try{validateCardLesson(input);}catch(e){throw Error(e.message||'درس البطاقات غير صالح.');}
  return JSON.parse(raw);
 }
 if(kind==='stage'){
  const title=clean(input.title,3,90),subtitle=clean(input.subtitle||'',0,180),intro=clean(input.intro,20,2500);
  if(!title||subtitle===null||!intro||!Array.isArray(input.tips)||input.tips.length>10||input.tips.some(x=>!clean(x,2,240)))
   throw Error('المحطة تحتاج عنوانًا ومقدمة واضحة ونصائح صالحة.');
  const doc={title,subtitle,intro,tips:input.tips.map(x=>x.trim())};
  if(input.script!==undefined){
   if(!validSchoolScript(input.script))throw Error('اختر نوع خط مدعوم.');
   doc.script=input.script;
  }
  if(input.practice!==undefined&&input.practice!==null){
   const model=clean(input.practice?.model,1,140),focus=clean(input.practice?.focus,3,100),
    instructions=clean(input.practice?.instructions,20,650);
   if(!model||!focus||!instructions)throw Error('تمرين الكتابة غير صالح.');
   doc.practice={model,focus,instructions};
   if(input.practice.script!==undefined){
    if(!validSchoolScript(input.practice.script))throw Error('نوع خط ورشة الكتابة غير صالح.');
    doc.practice.script=input.practice.script;
   }
  }
  if(input.lessons!==undefined){
   if(!Array.isArray(input.lessons)||input.lessons.length<2||input.lessons.length>8)
    throw Error('يتطلب الدرس المتدرج خطوتين إلى ثماني خطوات تعليمية.');
   doc.lessons=input.lessons.map(item=>{
    const heading=clean(item?.title,5,100),body=clean(item?.body,80,1700),
     example=clean(item?.example,2,220),note=clean(item?.note,12,420);
    if(!heading||!body||!example||!note)throw Error('أكمل عنوان كل شرح وتفاصيله ومثاله وملاحظته.');
    const lesson={title:heading,body,example,note};
    if(item.script!==undefined){
     if(!validSchoolScript(item.script))throw Error('نوع خط المثال غير صالح.');
     lesson.script=item.script;
    }
    return lesson;
   });
  }
  if(input.lab!==undefined){
   if(input.lab?.kind==='morse'){
    const sample=clean(input.lab.sample,1,30);
    if(!sample)throw Error('أضف رسالة مورس قصيرة.');
    try{encodeMorse(sample);}catch{throw Error('تدريب مورس يقبل الحروف اللاتينية A-Z والأرقام 0-9 فقط.');}
    doc.lab={kind:'morse',sample:sample.toUpperCase()};
   }else if(input.lab?.kind==='gates'){
    if(!GATE_TYPES.includes(input.lab.gate))throw Error('نوع البوابة غير مدعوم.');
    doc.lab={kind:'gates',gate:input.lab.gate};
   }else if(input.lab?.kind==='science'){
    const model=clean(input.lab.model,4,60),scenario=clean(input.lab.scenario,4,110);
    if(!model||!Object.hasOwn(SCIENCE_LABS,model)||!scenario)throw Error('اختر نموذجًا علميًا معروفًا واسم تجربة واضحًا.');
    doc.lab={kind:'science',model,scenario};
   }else if(input.lab?.kind==='civic'){
    const model=clean(input.lab.model,4,60),scenario=clean(input.lab.scenario,4,110);
    if(!model||!Object.hasOwn(CIVIC_LABS,model)||!scenario)throw Error('اختر مختبرًا سياسيًا أو اقتصاديًا معروفًا.');
    doc.lab={kind:'civic',model,scenario,...(input.lab.activity?{activity:validateCivicActivity(input.lab.activity)}:{})};
   }else throw Error('نوع المختبر التعليمي غير مدعوم.');
  }
  if(input.source!==undefined){
   const title=clean(input.source?.title,4,120),url=clean(input.source?.url,20,450);
   if(!title||!url||!/^https:\/\/(?:science[.]nasa[.]gov|www[.]nasa[.]gov|www[.]noaa[.]gov|www[.]usgs[.]gov|www[.]imf[.]org|www[.]worldbank[.]org|www[.]idea[.]int|www[.]federalreserve[.]gov|www[.]un[.]org)\//.test(url))
    throw Error('أضف رابطًا موثوقًا من المصادر العلمية أو المؤسسية المعتمدة.');
   doc.source={title,url};
  }
  return doc;
 }
 if(kind==='question'){
  const prompt=clean(input.prompt,10,350),target=clean(input.target||'',0,500),
   explanation=clean(input.explanation,10,800),type=input.kind||'choice';
  if(!prompt||target===null||!explanation)throw Error('نص السؤال أو شرحه غير صالح.');
  if(type==='choice'){
   if(!Array.isArray(input.options)||input.options.length!==4||input.options.some(x=>!clean(x,1,150))||
      new Set(input.options.map(x=>x.trim())).size!==4||!Number.isInteger(input.answerIndex)||
      input.answerIndex<0||input.answerIndex>3)throw Error('السؤال يحتاج أربعة خيارات مختلفة وإجابة محددة.');
   return {kind:'choice',prompt,target,explanation,options:input.options.map(x=>x.trim()),answerIndex:input.answerIndex};
  }
  if(type==='order'){
   const tokens=input.tokens,answer=input.answer;
   if(!Array.isArray(tokens)||tokens.length<3||tokens.length>7||tokens.some(x=>!clean(x,1,45))||
    new Set(tokens).size!==tokens.length||!Array.isArray(answer)||answer.length!==tokens.length||
    new Set(answer).size!==answer.length||answer.some(x=>!tokens.includes(x)))
    throw Error('سؤال الترتيب يحتاج كلمات فريدة وترتيبًا صحيحًا كاملًا.');
   return {kind:'order',prompt,target,explanation,tokens:[...tokens],answer:[...answer]};
  }
  if(type==='type'){
   const answer=clean(input.answer,1,80);
   if(!answer||!normalizeArabicAnswer(answer))throw Error('أضف إجابة نصية صحيحة قصيرة.');
   return {kind:'type',prompt,target,explanation,answer};
  }
  throw Error('نوع السؤال غير مدعوم.');
 }
 throw Error('نوع المحتوى غير مدعوم.');
}
export function publishedSchoolQuestion(row){
 const q=validateSchoolEditorial('question',row.published);
 const id='studio-'+row.id;
 if(q.kind==='choice')return {id,kind:'choice',prompt:q.prompt,target:q.target||null,
  options:q.options,answer:q.options[q.answerIndex],explanation:q.explanation};
 if(q.kind==='order')return {id,kind:'order',prompt:q.prompt,target:q.target||null,
  tokens:q.tokens,answer:q.answer,explanation:q.explanation};
 return {id,kind:'type',prompt:q.prompt,target:q.target||null,answer:q.answer,explanation:q.explanation};
}
// Reorder both questions and distractors deterministically per attempt.
 // The selected question snapshot (including answer keys) stays server-side.
function schoolShuffle(items,seed){
 const out=[...items];let state=2166136261;
 for(const character of String(seed)){state^=character.charCodeAt(0);state=Math.imul(state,16777619)>>>0;}
 for(let i=out.length-1;i>0;i--){
  state=(Math.imul(state,1664525)+1013904223)>>>0;
  const j=state%(i+1);[out[i],out[j]]=[out[j],out[i]];
 }
 return out;
}
export function chooseSchoolQuestions(rows,attemptNo){
 const pool=rows.filter(x=>x.published).map(publishedSchoolQuestion);
 if(pool.length<6)throw Error('ستة أسئلة منشورة مطلوبة.');
 const choices=pool.filter(q=>q.kind==='choice'),order=pool.filter(q=>q.kind==='order'),typed=pool.filter(q=>q.kind==='type');
 const offset=(attemptNo-1)%Math.max(1,choices.length);
 const personalize=(questions)=>questions.map(q=>{
  if(q.kind==='choice')return {...q,options:schoolShuffle(q.options,q.id+':options:'+attemptNo)};
  if(q.kind==='order')return {...q,tokens:schoolShuffle(q.tokens,q.id+':tokens:'+attemptNo)};
  return q;
 });
 // Rotate the larger authored pool: four knowledge questions, one sequencing
 // task and one written recall. Existing 6-question attempts remain unchanged.
 if(choices.length>=4&&order.length&&typed.length){
  const four=Array.from({length:4},(_,i)=>choices[(offset+i)%choices.length]);
  const pair=[order[(attemptNo-1)%order.length],typed[(attemptNo-1)%typed.length]];
  const combined=[...four.slice(0,2),pair[0],...four.slice(2),pair[1]];
  return personalize(combined);
 }
 return personalize(Array.from({length:6},(_,i)=>pool[(attemptNo-1+i)%pool.length]));
}
export function gradeSchoolChoice(questions,answers){
 if(!Array.isArray(questions)||questions.length!==6||!Array.isArray(answers)||answers.length!==6)
  throw Error('بيانات الاختبار غير مكتملة.');
 let score=0;
 const review=questions.map((q,i)=>{
  const a=answers[i];if(a?.id!==q.id)throw Error('معرف إجابة غير صالح.');
  let correct=false,answer='';
  if(q.kind==='choice'){
   if(!Number.isInteger(a.choice)||a.choice<0||a.choice>=q.options?.length)throw Error('خيار غير صالح.');
   correct=q.options[a.choice]===q.answer;answer=q.answer;
  }else if(q.kind==='order'){
   if(!Array.isArray(a.choice)||a.choice.length!==q.tokens?.length||
    new Set(a.choice).size!==q.tokens.length||a.choice.some(n=>!Number.isInteger(n)||n<0||n>=q.tokens.length))
    throw Error('ترتيب غير صالح.');
   correct=a.choice.map(n=>q.tokens[n]).every((token,j)=>token===q.answer[j]);
   answer=q.answer.join(' ← ');
  }else if(q.kind==='type'){
   if(typeof a.choice!=='string'||a.choice.length>80||!a.choice.trim())throw Error('إجابة نصية غير صالحة.');
   correct=normalizeArabicAnswer(a.choice)===normalizeArabicAnswer(q.answer);answer=q.answer;
  }else throw Error('نوع سؤال غير صالح.');
  if(correct)score++;
  return {id:q.id,correct,answer,explanation:q.explanation};
 });
 return {score,total:6,passed:score>=5,review};
}
export function publicSchoolChoice(questions){
 return questions.map(q=>({id:q.id,kind:q.kind,prompt:q.prompt,target:q.target||null,
  ...(q.kind==='choice'?{options:q.options}:{}),...(q.kind==='order'?{tokens:q.tokens}:{})}));
}
