'use client';

import Link from '@/components/SiteLink';
import {useMemo,useState} from 'react';
import {ArrowUpLeft,BookOpen,Building2,ChevronDown,ClipboardList,GraduationCap,MapPin,Phone,Search,SlidersHorizontal,Stethoscope,X} from 'lucide-react';
import ActiveFilters from './ActiveFilters';
import Pagination from './Pagination';
import ContentSurface from './design/ContentSurface';
import SaveForLater from './reading/SaveForLater';
import InstitutionLogo from './InstitutionLogo';
import useListState from './useListState';
import {collectionDefaults,listStateSearch} from '@/lib/listState';
import {formatNumber} from '@/lib/format';
import {medicalOperatingEvidence} from '@/lib/contentEvidence';
import {filterInstitutions,institutionFilterAll as ALL,ownershipLabels,universityTypeLabels,medicalTypeLabels} from '@/lib/institutionDirectories';
import useDeferredDetails,{withDetails} from './useDeferredDetails';

const pageSize=12;
const optionList=(label,values)=>[label,...new Set(values.filter(Boolean))];
const relationNames=(rows,key='name')=>rows.map(row=>row[key]).filter(Boolean);

function SelectFilter({label,value,onChange,children}){return <label className="institution-filter"><span>{label}</span><span className="institution-select"><select value={value} onChange={event=>onChange(event.target.value)}>{children}</select><ChevronDown size={15}/></span></label>;}

// items are light rows (lib/institutionDirectories institutionIndexItems); summaries and every
// programme or service detail arrive from detailsUrl after the page loads.
export default function InstitutionDirectory({kind,items:index,details:initialDetails,detailsUrl}){
  const {details,status,load}=useDeferredDetails(detailsUrl,initialDetails);
  const items=useMemo(()=>withDetails(index,details,'id'),[index,details]);
  const medical=kind==='medical',defaults=medical?collectionDefaults.medicalCenters:collectionDefaults.universities;
  const [state,update]=useListState(defaults);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const set=(key,value)=>update(key==='governorate'?{governorate:value,city:ALL.city,page:1}:{[key]:value,page:1});
  const hasEmergencyData=medical&&items.some(item=>item.emergencyAvailable===true);
  const fields=useMemo(()=>({
    governorates:optionList(ALL.governorate,items.map(item=>item.governorate)),
    cities:optionList(ALL.city,items.filter(item=>state.governorate===ALL.governorate||item.governorate===state.governorate).map(item=>item.city)),
    types:optionList(ALL.type,items.map(item=>item.type)),ownerships:optionList(ALL.ownership,items.map(item=>item.ownership)),
    focuses:optionList(ALL.focus,items.flatMap(item=>item.programFields||[])),levels:optionList(ALL.level,items.flatMap(item=>[...(item.educationLevels||[]),...(item.qualifications||[])])),modes:optionList(ALL.mode,items.flatMap(item=>[...(item.studyModes||[]),...(item.programModes||[])])),
    specialties:optionList(ALL.specialty,items.flatMap(item=>relationNames(item.specialties||[]))),services:optionList(ALL.service,items.flatMap(item=>relationNames(item.services||[]))),
  }),[items,state.governorate]);
  const results=useMemo(()=>filterInstitutions(items,state,kind),[items,kind,state]);
  const page=Math.min(state.page,Math.max(1,Math.ceil(results.length/pageSize))),basePath=medical?'/medical-centers':'/universities',anchor=medical?'#medical-directory':'#universities-directory';
  const returnTo=basePath+listStateSearch('',{...state,page},defaults)+anchor;
  const clear=()=>update(defaults);
  const active=Object.entries(state).filter(([key,value])=>!['page','sort'].includes(key)&&value!==defaults[key]&&value!=='').map(([key,value])=>({key,label:(key==='q'?'البحث':{governorate:'المحافظة',city:'المدينة',type:'النوع',ownership:'الجهة',focus:'المجال',level:'المستوى',mode:'نمط الدراسة',specialty:'التخصص',service:'الخدمة',emergency:'الطوارئ'}[key])+': '+value,onRemove:()=>set(key,defaults[key])}));
  const typeLabels=medical?medicalTypeLabels:universityTypeLabels;
  // Any use of the directory fetches the remaining details at once.
  return <div className={'institution-directory '+(medical?'medical':'education')} onPointerDownCapture={load} onFocusCapture={load}>
    <div className="institution-toolbar">
      <div className="institution-toolbar-primary">
        <div className="institution-search"><Search size={19} aria-hidden="true"/><input type="search" value={state.q} onChange={event=>set('q',event.target.value)} placeholder={medical?'ابحث عن مستشفى أو تخصص أو خدمة...':'ابحث عن جامعة أو معهد أو برنامج...'} aria-label={medical?'البحث في المراكز الطبية':'البحث في الجامعات والمعاهد'}/>{state.q&&<button type="button" onClick={()=>set('q','')} aria-label="مسح البحث"><X size={17}/></button>}</div>
        {fields.governorates.length>1&&<SelectFilter label="المحافظة" value={state.governorate} onChange={value=>set('governorate',value)}>{fields.governorates.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
        <button type="button" className="institution-filter-toggle" aria-expanded={filtersOpen} aria-controls={'institution-extra-'+kind} onClick={()=>setFiltersOpen(value=>!value)}>
          <SlidersHorizontal size={18} aria-hidden="true"/> فلاتر إضافية{active.length>0&&<span>{formatNumber(active.length)}</span>}<ChevronDown size={16} aria-hidden="true"/>
        </button>
      </div>
      <div id={'institution-extra-'+kind} className={'institution-extra-filters'+(filtersOpen?' is-open':'')}>
        {fields.cities.length>1&&<SelectFilter label="المدينة / المديرية" value={state.city} onChange={value=>set('city',value)}>{fields.cities.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
        {fields.types.length>1&&<SelectFilter label="نوع المؤسسة" value={state.type} onChange={value=>set('type',value)}>{fields.types.map(value=><option value={value} key={value}>{value===ALL.type?value:typeLabels[value]||value}</option>)}</SelectFilter>}
        {fields.ownerships.length>1&&<SelectFilter label="الجهة" value={state.ownership} onChange={value=>set('ownership',value)}>{fields.ownerships.map(value=><option value={value} key={value}>{value===ALL.ownership?value:ownershipLabels[value]||value}</option>)}</SelectFilter>}
        {medical?<>
          {fields.specialties.length>1&&<SelectFilter label="التخصص الطبي" value={state.specialty} onChange={value=>set('specialty',value)}>{fields.specialties.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
          {fields.services.length>1&&<SelectFilter label="الخدمة" value={state.service} onChange={value=>set('service',value)}>{fields.services.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
          {hasEmergencyData&&<SelectFilter label="الطوارئ" value={state.emergency} onChange={value=>set('emergency',value)}><option>الكل</option><option>موثق</option></SelectFilter>}
        </>:<>
          {fields.focuses.length>1&&<SelectFilter label="المجال الدراسي" value={state.focus} onChange={value=>set('focus',value)}>{fields.focuses.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
          {fields.levels.length>1&&<SelectFilter label="المستوى" value={state.level} onChange={value=>set('level',value)}>{fields.levels.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
          {fields.modes.length>1&&<SelectFilter label="نمط الدراسة" value={state.mode} onChange={value=>set('mode',value)}>{fields.modes.map(value=><option key={value}>{value}</option>)}</SelectFilter>}
        </>}
        <SelectFilter label="الترتيب" value={state.sort} onChange={value=>set('sort',value)}><option value="name">أبجديًا</option><option value="newest">الأحدث إضافة</option><option value="updated">الأحدث تحديثًا</option></SelectFilter>
      </div>
    </div>
    <ActiveFilters filters={active} onClear={clear}/>
    <div className="institution-results-line" aria-live="polite"><span>{medical?'المنشآت الطبية المطابقة':'المؤسسات التعليمية المطابقة'}</span><strong>{formatNumber(results.length)} نتيجة</strong>{state.q&&status!=='ready'&&<small> · البحث في الأسماء والمواقع فقط حتى يكتمل تحميل التفاصيل</small>}</div>
    {results.length?<div className="institution-grid">{results.slice((page-1)*pageSize,page*pageSize).map(item=>{
      const topics=medical?uniqCard([...relationNames(item.specialties),...relationNames(item.services)]).slice(0,3):item.topics;
      const offerings=medical?item.specialties.length+item.services.length:item.programCount;
      const OfferingIcon=medical?ClipboardList:BookOpen;
      return <ContentSurface kind="directory" className="institution-card" key={item.id}>
        <Link className="institution-card-link" href={`${basePath}/${encodeURIComponent(item.id)}?from=${encodeURIComponent(returnTo)}`}>
          <div className="institution-card-top">
            <div className="institution-card-icon"><InstitutionLogo src={item.logoUrl} name={item.name} maxSize={64} kind={medical?'medical':'university'}>{medical?<Stethoscope size={34}/>:<GraduationCap size={35}/>}</InstitutionLogo></div>
            <div className="institution-card-heading"><div className="institution-card-meta"><span>{item.typeLabel}</span><span>{item.ownershipLabel}</span></div><h2>{item.name}</h2></div>
          </div>
          <div className="institution-card-body">
            <p className="institution-location"><MapPin size={15} aria-hidden="true"/>{[item.governorate,item.city].filter(Boolean).join(' · ')||'الموقع التفصيلي غير متاح'}</p>
            {item.pending?<p className="institution-card-summary" role="status" style={{opacity:.75}}>{status==='failed'?'تعذر تحميل الوصف. المس الصفحة للمحاولة مجددًا.':'جارٍ تحميل الوصف…'}</p>:<p className="institution-card-summary">{item.summary}</p>}
            {medical&&medicalOperatingEvidence(item).kind==='historical'&&<p className="institution-card-evidence" role="note">بيانات تشغيل تاريخية ({item.operatingStatusAsOf})، وليست الحالة الحالية</p>}
            {topics.length>0&&<div className="institution-tags" aria-label={medical?'التخصصات والخدمات':'البرامج الدراسية'}>{topics.map(value=><span key={value}>{value}</span>)}</div>}
            <div className="institution-card-footer">
              <span className="institution-card-facts">{offerings>0?<><OfferingIcon size={15} aria-hidden="true"/>{formatNumber(offerings)} {medical?'خدمة وتخصصًا مدرجًا':'برنامجًا مدرجًا'}</>:<>{medical?'تفاصيل المنشأة':'معلومات المؤسسة'}</>}</span>
              <span className="institution-details-link">عرض الملف <ArrowUpLeft size={17} aria-hidden="true"/></span>
            </div>
          </div>
        </Link>
        <div className="card-save-action"><SaveForLater compact item={{kind:medical?'medicalCenter':'university',href:`${basePath}/${encodeURIComponent(item.id)}`,title:item.name}}/></div>
      </ContentSurface>;
    })}</div>:<div className="institution-empty"><Building2 size={36}/><h2>لا توجد نتائج مطابقة</h2><p>جرّب توسيع نطاق البحث أو مسح عوامل التصفية.</p><button className="btn btn-outline" type="button" onClick={clear}>مسح الفلاتر</button></div>}
    <Pagination page={page} count={results.length} pageSize={pageSize} onChange={value=>update({page:value})}/>
  </div>;
}
function uniqCard(values){return [...new Set(values.filter(Boolean))];}
