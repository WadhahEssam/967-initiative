'use client';
import {useMemo,useState} from 'react';
import Link from '@/components/SiteLink';
import {ArrowLeft,FileStack,ListOrdered,MapPin,Search,Star} from 'lucide-react';
import {CategoryArt} from './GuideView';
import {GUIDE_CATEGORIES} from '@/lib/transactionGuides';
import {formatArabicDate} from '@/lib/format';
import styles from './Transactions.module.css';

const normalize=value=>String(value||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ً-ْ]/g,'').toLowerCase();

function GuideCard({guide}){
 return <Link className={styles.card} href={'/transactions/'+guide.slug}>
  <CategoryArt category={guide.category} size={26}/>
  <span>
   <h3>{guide.title}</h3>
   {guide.summary&&<p>{guide.summary}</p>}
   <span className={styles.cardMeta}>
    {guide.steps>0&&<span><ListOrdered size={13} aria-hidden="true"/>{guide.steps} خطوات</span>}
    {guide.documents>0&&<span><FileStack size={13} aria-hidden="true"/>{guide.documents} أوراق</span>}
    {guide.cities.length>0&&<span><MapPin size={13} aria-hidden="true"/>{guide.cities.join(' و')}</span>}
   </span>
   {guide.verifiedAt?<small>آخر تحقق: {formatArabicDate(guide.verifiedAt)}</small>:<small>معلومات أولية</small>}
  </span>
  <ArrowLeft className={styles.cardGo} size={18} aria-hidden="true"/>
 </Link>;
}

// The published guides: a search, category filters with counts, the most requested first.
export default function GuideIndex({guides}){
 const [query,setQuery]=useState('');
 const [category,setCategory]=useState('all');
 const q=normalize(query).trim();
 const shown=useMemo(()=>guides.filter(guide=>(category==='all'||guide.category===category)&&(!q||normalize(guide.title+' '+guide.summary+' '+(guide.keywords||'')).includes(q))),[guides,category,q]);
 const categories=GUIDE_CATEGORIES.map(item=>({...item,count:guides.filter(guide=>guide.category===item.id).length})).filter(item=>item.count);
 const featured=!q&&category==='all'?guides.filter(guide=>guide.featured):[];
 const groups=GUIDE_CATEGORIES.map(item=>({category:item,items:shown.filter(guide=>guide.category===item.id)})).filter(group=>group.items.length);
 return <div className={styles.index}>
  <div className={styles.finder}>
   <label className={styles.search}>
    <Search size={18} aria-hidden="true"/>
    <span className="sr-only">ابحث عن معاملة</span>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ابحث: جواز، بطاقة، رخصة، سجل تجاري…" autoComplete="off"/>
   </label>
   {categories.length>1&&<div className={styles.filters} role="group" aria-label="التصنيف">
    <button type="button" aria-pressed={category==='all'} onClick={()=>setCategory('all')}>الكل <b>{guides.length}</b></button>
    {categories.map(item=><button key={item.id} type="button" aria-pressed={category===item.id} onClick={()=>setCategory(item.id)}>{item.name} <b>{item.count}</b></button>)}
   </div>}
  </div>
  {featured.length>0&&<section className={styles.featured} aria-labelledby="guides-featured">
   <h2 id="guides-featured"><Star size={18} aria-hidden="true"/> الأكثر طلبًا</h2>
   <div className={styles.featuredRow}>{featured.map(guide=><Link key={guide.slug} href={'/transactions/'+guide.slug} className={styles.featuredCard}>
    <CategoryArt category={guide.category} size={24}/>
    <strong>{guide.title}</strong>
    <small>{guide.steps} خطوات · {guide.documents} أوراق</small>
   </Link>)}</div>
  </section>}
  {groups.length?<div className={styles.groups}>{groups.map(({category:item,items})=><section key={item.id} className={styles.group} aria-labelledby={'guides-'+item.id}>
   <h2 id={'guides-'+item.id}>{item.name}</h2>
   <div className={styles.cards}>{items.map(guide=><GuideCard key={guide.slug} guide={guide}/>)}</div>
  </section>)}</div>:<p className={styles.empty} role="status">لا توجد معاملة بهذا الاسم. <Link href={'/contribute?type='+encodeURIComponent('اقتراح موضوع')}>اقترح إضافتها</Link>.</p>}
 </div>;
}
