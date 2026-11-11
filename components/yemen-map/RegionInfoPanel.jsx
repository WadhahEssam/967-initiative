'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpLeft,ChevronDown,ChevronRight,MapPinned,X} from 'lucide-react';
import {formatNumber} from './mapGeometry';
import InlineTarget from '../inline/InlineTarget';
import Image from 'next/image';
import {safeImageUrl,safeExternalUrl,servedImageUrl} from '@/lib/media';

const missing = 'البيانات غير متوفرة حاليًا';

function Field({label, value}) {
  return <div className="ymap-info-field"><span>{label}</span><strong>{value===null||value===undefined||value===''?missing:value}</strong></div>;
}

export default function RegionInfoPanel({
  country,
  region,
  regionType,
  districts,
  profiles,
  source,
  onClose,
  onDistrictSelect,
  onGovernorateBack,
  showFigures=true,
  profileError='',
}) {
  const isDistrict = regionType === 'district';
  const isGovernorate = regionType === 'governorate';
  // Phones: while a chosen place's panel is still below the screen, a small bar
  // above the tab bar names it and jumps to the details. The panel is unchanged.
  const panelRef = useRef(null);
  const [panelBelow, setPanelBelow] = useState(false);
  useEffect(() => {
    const panel = panelRef.current;
    if (!region || !panel || typeof IntersectionObserver === 'undefined') {setPanelBelow(false);return undefined;}
    const observer = new IntersectionObserver(([entry]) => setPanelBelow(!entry.isIntersecting && entry.boundingClientRect.top > 0));
    observer.observe(panel);
    return () => observer.disconnect();
  }, [region]);
  const profile = region ? profiles[region.id] || {} : {};
  const districtList = isGovernorate ? districts.filter(item => item.governorateId === region.id) : [];
  const title = region?.nameAr || 'خريطة اليمن';
  const descriptiveFields=[['description','نبذة تعريفية'],['history','نبذة تاريخية'],['geography','الطبيعة والتضاريس'],['economy','الاقتصاد وسبل العيش'],['landmarks','المعالم والأنشطة']];

  return <>
  {region && panelBelow && <div className="ymap-peek" role="group" aria-label={'المكان المختار: ' + (region.nameAr || '')}>
    <MapPinned size={18} aria-hidden="true"/>
    <span><strong>{region.nameAr}</strong><small>{isDistrict ? 'مديرية · ' + (region.governorateNameAr || '') : 'محافظة'}</small></span>
    <button type="button" onClick={() => panelRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'})}>التفاصيل <ChevronDown size={16} aria-hidden="true"/></button>
    <button type="button" className="ymap-peek-close" onClick={onClose} aria-label="إلغاء اختيار المكان"><X size={16} aria-hidden="true"/></button>
  </div>}
  <aside ref={panelRef} className={'ymap-info-panel ' + (region ? 'has-region' : '')} aria-label="لوحة معلومات المنطقة">
    <div className="ymap-info-head">
      <div><span className="eyebrow">{region ? (isDistrict ? 'مديرية' : 'محافظة') : 'خريطة اليمن'}</span><h2>{title}</h2></div>
      {region && <button type="button" onClick={onClose} title="إغلاق اللوحة" aria-label="إغلاق اللوحة"><X size={18}/></button>}
    </div>

    {!region && <div className="ymap-info-empty" tabIndex={0} role="region" aria-label="دليل استخدام الخريطة">
      <MapPinned size={30}/>
      <p>اختر محافظة من الخريطة أو استخدم البحث لعرض المديريات والمعلومات المتاحة. لا تُعرض أرقام غير موثقة؛ الحقول غير المتوفرة تظهر بوضوح.</p>
      <dl>
        <div><dt>المحافظات</dt><dd>{formatNumber(22)}</dd></div>
        <div><dt>المديريات</dt><dd>{formatNumber(335)}</dd></div>
        <div><dt>المصدر</dt><dd>{source.provider}</dd></div>
      </dl>
    </div>}

    {region && <div className="ymap-info-body" tabIndex={0} role="region" aria-label={'تفاصيل ' + title}>
      {profileError&&<p className="stat-warning" role="status">{profileError}</p>}
      <InlineTarget kind={isDistrict?'district':'governorate'} id={region.id} title={title} href={'/yemen-map?'+(isDistrict?'district=':'region=')+encodeURIComponent(region.id)+'#map'}/>
      {isDistrict && <button type="button" className="ymap-backline" onClick={onGovernorateBack}><ChevronRight size={16}/> العودة إلى محافظة {region.governorateNameAr}</button>}
      <div className="ymap-info-grid">
        <Field label={isDistrict ? 'اسم المديرية' : 'اسم المحافظة'} value={region.nameAr}/>
        <Field label="الاسم الإنجليزي" value={region.nameEn}/>
        <Field label="المعرّف الإداري" value={region.pcode}/>
        {isDistrict && <Field label="المحافظة" value={region.governorateNameAr}/>}
        <Field label="المركز الإداري" value={profile.capital}/>
        <Field label="المساحة كم²" value={profile.area_km2 ? formatNumber(profile.area_km2) : region.areaKm2 ? formatNumber(region.areaKm2) : missing}/>
        <Field label="السكان" value={profile.population!==null&&profile.population!==undefined ? `${formatNumber(profile.population)}${profile.population_year ? ` · ${profile.population_year}` : ''}` : missing}/>
        {isGovernorate && <Field label="عدد المديريات" value={formatNumber(region.districtCount)}/>}
      </div>
      {safeImageUrl(profile.image_url)&&profile.image_credit&&safeExternalUrl(profile.image_source_url)&&<figure className="ymap-region-photo"><Image unoptimized width={480} height={280} src={servedImageUrl(profile.image_url,480)} alt={'منظر من '+title} loading="lazy"/><figcaption>{profile.image_credit} <a href={safeExternalUrl(profile.image_source_url)} target="_blank" rel="noopener noreferrer">مصدر الصورة</a></figcaption></figure>}

      {isDistrict&&<a className="text-link" href={"/yemen-map/districts/"+encodeURIComponent(region.id)}>اقرأ الصفحة الكاملة لمديرية {title}<ArrowUpLeft size={16} aria-hidden="true"/></a>}
      {isGovernorate&&<a className="text-link" href={"/yemen-map/governorates/"+encodeURIComponent(region.id)}>اقرأ الملف المعرفي الكامل لمحافظة {title}<ArrowUpLeft size={16} aria-hidden="true"/></a>}
      {descriptiveFields.filter(([key])=>profile[key]).map(([key,label])=><section key={key}><h3>{label}</h3>{String(profile[key]).split(/\n\s*\n/).filter(Boolean).map((text,index)=><p key={index}>{text}</p>)}</section>)}
      {descriptiveFields.some(([key])=>!profile[key])&&<p className="ymap-profile-pending">قيد التوثيق: {descriptiveFields.filter(([key])=>!profile[key]).map(([,label])=>label).join('، ')}.</p>}
      {Array.isArray(profile.sources)&&profile.sources.length>0&&<section className="ymap-profile-sources"><h3>مصادر معلومات المكان</h3><ul>{profile.sources.filter(item=>safeExternalUrl(item.url)).map((item,index)=><li key={index}><a href={safeExternalUrl(item.url)} target="_blank" rel="noopener noreferrer">{item.title}<ArrowUpLeft size={13}/></a></li>)}</ul></section>}

      {isGovernorate && <section>
        {showFigures&&<a className="text-link" href={"/yemeni-figures?region="+encodeURIComponent(region.id)}>اكتشف الشخصيات المرتبطة بمحافظة {region.nameAr}<ArrowUpLeft size={14}/></a>}
        <h3>المديريات التابعة</h3>
        <div className="ymap-district-list">
          {districtList.map(district => <button type="button" key={district.id} onClick={() => onDistrictSelect(district)}>
            {district.nameAr}<ArrowUpLeft size={14}/>
          </button>)}
        </div>
      </section>}
    </div>}

    <footer>
      <span>المصدر: {source.title}</span>
      <span>{source.license}</span>
    </footer>
  </aside>
  </>;
}
