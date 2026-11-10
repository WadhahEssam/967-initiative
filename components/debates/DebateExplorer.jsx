'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from '@/components/SiteLink';
import {MessagesSquare,ArrowDown,MessageCircle,ChevronDown} from 'lucide-react';
import {DEBATE_CATEGORIES,DEBATE_DESCRIPTION,DEBATE_EMPTY,debateListState,DEBATE_STAGE_FILTERS,matchesDebateStage,selectFeaturedDebate,debateExplorerPage,featuredDebateHeading} from '@/lib/debates';
import {matchesSearch} from '@/lib/search';
import DebateCard from './DebateCard';
import DebateLogo from './DebateLogo';
import PageIntro from '@/components/PageIntro';
import DebateGuide from './DebateGuide';
import ActiveFilters from '@/components/ActiveFilters';
export default function DebateExplorer({debates=[],available=true,initial={}}){
 const seed=debateListState(new URLSearchParams(Object.entries(initial).filter(([,v])=>typeof v==='string')));
 const [query,setQuery]=useState(seed.q),[category,setCategory]=useState(seed.category),[type,setType]=useState(seed.type),[stage,setStage]=useState(seed.stage),[sort,setSort]=useState(seed.sort),[page,setPage]=useState(seed.page);
 const [filtersOpen,setFiltersOpen]=useState(Boolean(seed.category||seed.type||seed.sort!=='newest'));
 const filtered=useMemo(()=>debates.filter(d=>(!category||d.category===category)&&(!type||d.debate_type===type)&&matchesDebateStage(d,stage)&&matchesSearch(query,[d.title,d.question,d.description,...(d.participants||[]).map(p=>p.speaker.name)])).sort((a,b)=>{
  if(sort==='title')return a.title.localeCompare(b.title,'ar');
  const aDate=Date.parse(a.scheduled_at||a.created_at||''),bDate=Date.parse(b.scheduled_at||b.created_at||'');
  // Missing dates always sort last instead of producing NaN and unstable order.
  if(!Number.isFinite(aDate))return Number.isFinite(bDate)?1:a.title.localeCompare(b.title,'ar');
  if(!Number.isFinite(bDate))return -1;
  return (sort==='oldest'?aDate-bDate:bDate-aDate)||a.title.localeCompare(b.title,'ar');
 }),[debates,category,type,stage,query,sort]);
 const {pages,current,featured,items}=debateExplorerPage(filtered,selectFeaturedDebate(debates),page);
 useEffect(()=>{const restore=()=>{const next=debateListState(location.search);setQuery(next.q);setCategory(next.category);setType(next.type);setStage(next.stage);setSort(next.sort);setPage(next.page);setFiltersOpen(Boolean(next.category||next.type||next.sort!=='newest'));};window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);},[]);
 useEffect(()=>{const params=new URLSearchParams();for(const [k,v] of Object.entries({q:query,category,type,stage,sort:sort==='newest'?'':sort,page:current>1?String(current):''}))if(v)params.set(k,v);history.replaceState(null,'','/debates'+(params.size?'?'+params:'')+location.hash);},[query,category,type,stage,sort,current]);
 function filter(setter,value){setter(value);setPage(1);}
 const resetFilters=()=>{setQuery('');setCategory('');setType('');setStage('');setSort('newest');setPage(1);};
 return <div className="debates-page"><PageIntro tone="blue" title="في الاختلاف رحمة." crumb="مناظرات 967" description={DEBATE_DESCRIPTION} art={<DebateLogo decorative priority sizes="150px"/>}><DebateGuide/></PageIntro>
  <div className="container debate-content">{!available&&<p className="debate-service-note" role="status">خدمة المناظرات غير متاحة حالياً. يمكنك تصفح هذا القسم والمحاولة لاحقاً.</p>}
   {featured&&<section className="debate-featured"><div className="debate-section-heading"><h2>{featuredDebateHeading(featured)}</h2><span>أفكار مختلفة، وحوار مشترك</span></div><DebateCard debate={featured} featured/></section>}
   <section id="explore"><div className="debate-section-heading"><div><span className="eyebrow">اكتشف الحوار</span><h2>المناظرات والأرشيف</h2></div><span>{filtered.length} مناظرة</span></div><div className="debate-filters"><label className="debate-search">ابحث في المناظرات<input type="search" placeholder="موضوع، سؤال أو اسم مناظر…" value={query} onChange={e=>filter(setQuery,e.target.value)}/></label><label>المرحلة<select aria-label="المرحلة" value={stage} onChange={e=>filter(setStage,e.target.value)}><option value="">كل المراحل</option>{Object.entries(DEBATE_STAGE_FILTERS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><button type="button" className="debate-mobile-filter-toggle" aria-expanded={filtersOpen} aria-controls="debate-more-filters" onClick={()=>setFiltersOpen(value=>!value)}><span>فلاتر إضافية {category||type||sort!=='newest'?'· مفعّلة':''}</span><ChevronDown size={18} aria-hidden="true"/></button><div id="debate-more-filters" className="debate-extra-fields" data-open={filtersOpen}><label>التصنيف<select value={category} onChange={e=>filter(setCategory,e.target.value)}><option value="">كل القضايا</option>{DEBATE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></label><label>النوع<select value={type} onChange={e=>filter(setType,e.target.value)}><option value="">الكل</option><option value="external_live">مباشرة خارجياً</option><option value="prerecorded">مسجلة مسبقاً</option></select></label><label>الترتيب<select value={sort} onChange={e=>filter(setSort,e.target.value)}><option value="newest">الأحدث</option><option value="oldest">الأقدم</option><option value="title">العنوان</option></select></label></div></div>
    <ActiveFilters filters={[query&&{key:'q',label:'البحث: '+query,onRemove:()=>filter(setQuery,'')},category&&{key:'category',label:'التصنيف: '+category,onRemove:()=>filter(setCategory,'')},type&&{key:'type',label:'النوع: '+(type==='prerecorded'?'مسجلة مسبقاً':'مباشرة خارجياً'),onRemove:()=>filter(setType,'')},stage&&{key:'stage',label:'المرحلة: '+(DEBATE_STAGE_FILTERS[stage]||stage),onRemove:()=>filter(setStage,'')},sort!=='newest'&&{key:'sort',label:'الترتيب: '+(sort==='title'?'العنوان':'الأقدم'),onRemove:()=>filter(setSort,'newest')}]} onClear={resetFilters}/>
    {filtered.length?<>{items.length>0&&<div className="debate-grid">{items.map(d=><DebateCard debate={d} key={d.id}/>)}</div>}{pages>1&&<nav className="debate-actions" aria-label="صفحات المناظرات"><button disabled={current===1} onClick={()=>setPage(current-1)}>السابق</button><span>صفحة {current} من {pages}</span><button disabled={current===pages} onClick={()=>setPage(current+1)}>التالي</button></nav>}</>:<div className="debate-empty"><MessagesSquare size={44} strokeWidth={1.2}/><h3>{debates.length?'لم نجد مناظرات مطابقة':'قريباً، يبدأ الحوار.'}</h3><p>{debates.length?'جرّب كلمات أخرى أو غيّر الفلاتر.':DEBATE_EMPTY}</p>{debates.length>0&&<button type="button" className="btn btn-outline" onClick={resetFilters}>عرض جميع المناظرات</button>}{!debates.length&&<Link href="/register?next=%2Fdebates%2Fsuggest" className="btn btn-primary">أنشئ حساباً واقترح أول موضوع</Link>}</div>}
   </section><section className="debate-suggest-banner"><MessageCircle size={34}/><div><h2>أي قضية تستحق أن نتحاور حولها؟</h2><p>اقترح سؤالاً ومواقف مختلفة. تراجع هيئة التحرير كل مقترح قبل اعتماده.</p></div><Link className="btn btn-primary" href="/debates/suggest">اقترح مناظرة</Link></section>
  </div></div>;
}
