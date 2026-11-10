'use client';
import {useMemo,useState} from 'react';
import Link from '@/components/SiteLink';
import {ArrowLeft,Search} from 'lucide-react';
import {CategoryArt} from './GuideView';
import {GUIDE_CATEGORIES} from '@/lib/transactionGuides';
import {formatArabicDate} from '@/lib/format';
import styles from './Transactions.module.css';

const normalize=value=>String(value||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[ً-ْ]/g,'').toLowerCase();

// The published guides, grouped by category, with a search over titles and summaries.
export default function GuideIndex({guides}){
 const [query,setQuery]=useState('');
 const shown=useMemo(()=>{const q=normalize(query).trim();return q?guides.filter(guide=>normalize(guide.title+' '+guide.summary).includes(q)):guides;},[guides,query]);
 const groups=GUIDE_CATEGORIES.map(category=>({category,items:shown.filter(guide=>guide.category===category.id)})).filter(group=>group.items.length);
 return <div className={styles.index}>
  <label className={styles.search}>
   <Search size={18} aria-hidden="true"/>
   <span className="sr-only">ابحث عن معاملة</span>
   <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ابحث: جواز، بطاقة، رخصة…" autoComplete="off"/>
  </label>
  {groups.length?<div className={styles.groups}>{groups.map(({category,items})=><section key={category.id} className={styles.group} aria-labelledby={'guides-'+category.id}>
   <h2 id={'guides-'+category.id}>{category.name}</h2>
   <div className={styles.cards}>{items.map(guide=><Link key={guide.slug} className={styles.card} href={'/transactions/'+guide.slug}>
    <CategoryArt category={guide.category} size={26}/>
    <span>
     <h3>{guide.title}</h3>
     {guide.summary&&<p>{guide.summary}</p>}
     <small>{guide.verifiedAt?'آخر تحقق: '+formatArabicDate(guide.verifiedAt):''}</small>
    </span>
    <ArrowLeft className={styles.cardGo} size={18} aria-hidden="true"/>
   </Link>)}</div>
  </section>)}</div>:<p className={styles.empty} role="status">لا توجد معاملة بهذا الاسم. <Link href={'/contribute?type='+encodeURIComponent('اقتراح موضوع')}>اقترح إضافتها</Link>.</p>}
 </div>;
}
