'use client';

import Image from 'next/image';
import {canOptimizeImage} from '@/lib/media';
import Link from '@/components/SiteLink';
import {useEffect, useMemo, useState} from 'react';
import {ArrowUpLeft, AtSign, Facebook, Globe2, MapPinned, Search, Youtube} from 'lucide-react';
import ActiveFilters from '@/components/ActiveFilters';
import SaveForLater from '@/components/reading/SaveForLater';
import {figureFilterDefaults,readFigureFilters,figureFilterSearch,filterFigures} from '@/lib/figureFilters';
import {yemenGovernorates, yemeniFigureEras} from '@/lib/yemeniFigures';
import {formatNumber, toLatinDigits} from '@/lib/format';
import {hasFigureImageProvenance} from '@/lib/contentEvidence';

const socialLinks = figure => [
  {url: figure.website, label: 'الموقع الإلكتروني', icon: Globe2},
  {url: figure.facebookUrl, label: 'فيسبوك', icon: Facebook},
  {url: figure.instagramUrl, label: 'إنستغرام', icon: AtSign},
  {url: figure.xUrl, label: 'منصة X', icon: AtSign},
  {url: figure.youtubeUrl, label: 'يوتيوب', icon: Youtube},
].filter(item => item.url);

function lifeYears(figure) {
  if (!figure.birthYear && !figure.deathYear) return '';
  return figure.deathYear ? `${figure.birthYear || '؟'} – ${figure.deathYear}` : `الميلاد: ${figure.birthYear}`;
}

function figureInitials(name) {
  return String(name || '').split(/\s+/).filter(word => !['الملكة', 'الملك', 'بن', 'بنت'].includes(word)).slice(0, 2)
    .map(word => word.replace(/^ال/, '').slice(0, 1)).join(' ');
}

export default function YemeniFiguresDirectory({figures, selectedGovernorateId,onGovernorateChange}) {
  const [filters,setFilters]=useState(figureFilterDefaults),[ready,setReady]=useState(false),[more,setMore]=useState(false);
  const {figureQ:query,field,era,social:withSocial,photo,century,birthFrom,birthTo,figureSort,visible:visibleCount}=filters;
  const change=patch=>setFilters(f=>({...f,visible:12,...patch}));
  useEffect(()=>{const load=()=>{const f=readFigureFilters(location.search);setFilters(f);setMore(Boolean(f.photo||f.social||f.century||f.birthFrom||f.birthTo));setReady(true);};load();window.addEventListener('popstate',load);return()=>window.removeEventListener('popstate',load);},[]);
  useEffect(()=>{if(!ready)return;const p=figureFilterSearch(location.search,filters);const url=location.pathname+(p.size?'?'+p:'')+location.hash;if(url!==location.pathname+location.search+location.hash)history.replaceState(history.state,'',url);},[filters,ready]);
  const fields=useMemo(()=>[...new Set(figures.map(f=>f.field).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')),[figures]);
  const featuredFields=useMemo(()=>{
    const counts=new Map();
    for(const figure of figures)if(figure.field)counts.set(figure.field,(counts.get(figure.field)||0)+1);
    return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ar')).slice(0,5);
  },[figures]);
  const governorates=useMemo(()=>yemenGovernorates.filter(g=>figures.some(f=>f.governorateId===g.id)),[figures]);
  const centuries=useMemo(()=>[...new Set(figures.filter(f=>Number.isInteger(f.birthYear)).map(f=>Math.ceil(f.birthYear/100)))].sort((a,b)=>a-b),[figures]);
  const filteredFigures=useMemo(()=>filterFigures(figures,{...filters,region:selectedGovernorateId}),[figures,filters,selectedGovernorateId]);
  const visibleFigures=filteredFigures.slice(0,visibleCount);
  const hasAddedDates=figures.some(f=>f.createdAt&&Number.isFinite(Date.parse(f.createdAt)));
  function resetFilters(){setFilters({...figureFilterDefaults});onGovernorateChange(null);}
  const returnParams=figureFilterSearch('',filters);if(selectedGovernorateId)returnParams.set('region',selectedGovernorateId);
  const returnTo='/yemeni-figures'+(returnParams.size?'?'+returnParams:'');

  return <section className="yfigures-section" id="yemeni-figures">
    <div className="container yfigures-container">
      <h2 className="sr-only">دليل الشخصيات اليمنية</h2>

      {figures.some(figure=>figure.isDemo) && <p className="data-disclosure">يتضمن العرض ملفات من الكتالوج التجريبي للمشروع. هذه الملفات موسومة كتوضيحية وتحتاج مراجعة مصادرها قبل اعتمادها كمحتوى منشور.</p>}

      <section className="yfigures-discovery" aria-label="اكتشف الشخصيات بحسب مجالها">
        <header><div><span className="eyebrow">ابدأ بالمجال الذي يهمك</span><h3>وجوه اليمن، مجالات متعددة</h3></div><p>توزيع ملفات هذا الدليل حسب المجال المسجل؛ الأعداد ليست تقييمًا لأهمية المجالات.</p></header>
        <div className="yfigures-field-shortcuts">
          <button type="button" className={field==='الكل'?'selected':''} aria-pressed={field==='الكل'} onClick={()=>change({field:'الكل'})}><strong>جميع المجالات</strong><span>{formatNumber(figures.length)} شخصية</span></button>
          {featuredFields.map(([name,count])=><button type="button" key={name} className={field===name?'selected':''} aria-pressed={field===name} onClick={()=>change({field:name})}><strong>{name}</strong><span>{formatNumber(count)} شخصية</span></button>)}
        </div>
      </section>
      <div className="yfigures-filters" role="search" aria-label="البحث وتصفية الشخصيات">
        <label className="yfigures-search"><Search size={19}/><span className="sr-only">ابحث بالاسم</span><input type="search" value={query} onChange={e=>change({figureQ:e.target.value})} placeholder="ابحث بالاسم أو العمل أو الأثر..." aria-label="البحث في الشخصيات اليمنية"/></label>
        <label><span>المجال</span><select value={field} onChange={e=>change({field:e.target.value})}><option>الكل</option>{fields.map(item=><option key={item}>{item}</option>)}</select></label>
        <label><span>المحافظة المرتبطة</span><select value={selectedGovernorateId||''} onChange={e=>{setFilters(f=>({...f,visible:12}));onGovernorateChange(e.target.value||null);}}><option value="">كل المحافظات</option>{governorates.map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select></label>
        <label><span>الفترة</span><select value={era} onChange={e=>change({era:e.target.value})}><option>الكل</option>{yemeniFigureEras.map(item=><option key={item}>{item}</option>)}</select></label>
      </div>
      <details className="yfigures-extra-filters" open={more} onToggle={e=>setMore(e.currentTarget.open)}><summary>المزيد من الفلاتر <span>{[withSocial,photo,century,birthFrom,birthTo].filter(Boolean).length||''}</span></summary><div className="yfigures-filters">
        <label className="yfigures-check"><input type="checkbox" checked={withSocial} onChange={e=>change({social:e.target.checked})}/><span>لديها روابط تواصل</span></label>
        <label className="yfigures-check"><input type="checkbox" checked={photo} onChange={e=>change({photo:e.target.checked})}/><span>لديها صورة مسجلة</span></label>
        <label><span>قرن الميلاد المسجل</span><select value={century} onChange={e=>change({century:e.target.value})}><option value="">كل القرون</option>{centuries.map(c=><option key={c} value={c}>القرن {formatNumber(c)}</option>)}</select></label>
        <label><span>سنة الميلاد من</span><input type="number" min="500" max="2100" value={birthFrom} onChange={e=>change({birthFrom:e.target.value})}/></label>
        <label><span>سنة الميلاد إلى</span><input type="number" min="500" max="2100" value={birthTo} onChange={e=>change({birthTo:e.target.value})}/></label>
      </div><p>الارتباط بالمحافظة لا يعني مكان الميلاد. التصفية الزمنية تستخدم سنوات الميلاد المسجلة فقط وتستبعد التواريخ المجهولة.</p></details>
      <ActiveFilters filters={[query&&{key:'q',label:'البحث: '+query,onRemove:()=>change({figureQ:''})},field!=='الكل'&&{key:'field',label:'المجال: '+field,onRemove:()=>change({field:'الكل'})},selectedGovernorateId&&{key:'region',label:'المحافظة: '+(yemenGovernorates.find(g=>g.id===selectedGovernorateId)?.name||'غير متاحة'),onRemove:()=>onGovernorateChange(null)},era!=='الكل'&&{key:'era',label:'الفترة: '+era,onRemove:()=>change({era:'الكل'})},withSocial&&{key:'social',label:'روابط تواصل',onRemove:()=>change({social:false})},photo&&{key:'photo',label:'صورة مسجلة',onRemove:()=>change({photo:false})},century&&{key:'century',label:'قرن الميلاد: '+century,onRemove:()=>change({century:''})},birthFrom&&{key:'birthFrom',label:'الميلاد من: '+birthFrom,onRemove:()=>change({birthFrom:''})},birthTo&&{key:'birthTo',label:'الميلاد إلى: '+birthTo,onRemove:()=>change({birthTo:''})}]} onClear={resetFilters}/>
      <div className="yfigures-results-bar"><span role="status" aria-live="polite"><strong>{formatNumber(filteredFigures.length)}</strong> شخصية مطابقة</span>{selectedGovernorateId&&<small>تظهر الشخصيات المرتبطة بالمحافظة المحددة</small>}<label className="yfigures-sort">الترتيب<select value={figureSort} onChange={e=>change({figureSort:e.target.value})}><option value="default">ترتيب الدليل</option><option value="alpha">أبجديًا</option><option value="field">حسب المجال</option><option value="oldest">الميلاد: الأقدم أولًا</option><option value="youngest">الميلاد: الأحدث أولًا</option>{hasAddedDates&&<option value="newest">الأحدث إضافة في قاعدة البيانات</option>}</select></label></div>

      {filteredFigures.length ? <div className="yfigures-grid">
        {visibleFigures.map(figure => {
          const links = socialLinks(figure);
          return <article className="yfigure-card" key={figure.id}>
            <Link className="yfigure-card-hitarea" href={'/yemeni-figures/'+figure.slug+'?from='+encodeURIComponent(returnTo)} aria-label={`عرض صفحة ${figure.fullName}`}><span className="sr-only">عرض صفحة {figure.fullName}</span></Link>
            <div className="yfigure-image">
              {hasFigureImageProvenance(figure) ? <Image src={figure.imageUrl} alt={figure.imageKind==='context'?figure.imageCredit:`صورة ${figure.fullName}`} fill sizes="88px" unoptimized={!canOptimizeImage(figure.imageUrl)} /> : <span className="yfigure-initials">{figureInitials(figure.fullName)}</span>}
            </div>
            <div className="yfigure-content">
              <div className="yfigure-meta"><span className="yfigure-era">{figure.era}</span><span>{figure.field}</span>{lifeYears(figure) && <span dir="ltr">{lifeYears(figure)}</span>}</div>
              <h3>{figure.fullName}</h3>
              {figure.isDemo && <span className="status-badge">ملف توضيحي — يحتاج مراجعة</span>}
              <strong>{toLatinDigits(figure.knownFor)}</strong>
              <p>{toLatinDigits(figure.shortBio)}</p>
              <div className="yfigure-footer">
                {figure.governorateName&&<span className="yfigure-location"><MapPinned size={17}/>{figure.governorateName}<small>المحافظة المرتبطة</small></span>}
                {links.length > 0 && <div className="yfigure-socials">{links.map(({url, label, icon: Icon}) => <a href={url} target="_blank" rel="noreferrer" aria-label={`${label} - ${figure.fullName}`} title={label} key={label}><Icon size={17}/></a>)}</div>}
                {links.length === 0 && <ArrowUpLeft className="yfigure-open-icon" size={20} aria-hidden="true"/>}
              </div>
              {figure.imageSourceUrl&&<a className="yfigure-photo-credit" href={figure.imageSourceUrl} target="_blank" rel="noopener noreferrer" title={figure.imageCredit}>الصورة: {figure.imageCredit||'مصدر الصورة وحقوقها'}</a>}
            </div>
            <div className="card-save-action">{/* Preserve saved-item identity; old bookmark paths redirect to the new profile. */}<SaveForLater compact item={{kind:'figure',href:'/yemen-map/figures/'+encodeURIComponent(figure.slug),title:figure.fullName}}/></div>
          </article>;
        })}
      </div> : <div className="yfigures-empty"><Search size={28}/><h3>لا توجد نتائج مطابقة</h3><p>جرّب تغيير المجال أو المحافظة أو مسح عبارة البحث.</p><button type="button" className="btn btn-outline" onClick={resetFilters}>مسح الفلاتر</button></div>}
      {visibleCount < filteredFigures.length && <button type="button" className="yfigures-more" onClick={() => setFilters(f=>({...f,visible:f.visible+12}))}>عرض المزيد <span>{Math.min(12, filteredFigures.length - visibleCount)}</span></button>}
    </div>
  </section>;
}
