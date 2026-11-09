'use client';
import {useState} from 'react';
import Link from '@/components/SiteLink';
import Image from 'next/image';
import {Search,ArrowUpLeft,CalendarDays,BookOpen} from 'lucide-react';
import {canOptimizeImage} from '@/lib/media';
import {formatArabicDate,formatNumber} from '@/lib/format';
import {downloadCountLabel} from '@/lib/issueDownloads';
import {matchesSearch} from '@/lib/search';
import Pagination from './Pagination';
import ActiveFilters from './ActiveFilters';
import SaveForLater from './reading/SaveForLater';
import ContentSurface from './design/ContentSurface';

export default function IssueGrid({issues}) {
  const [search,setSearch]=useState(''),[page,setPage]=useState(1);
  const results=issues.filter(issue=>matchesSearch(search,[issue.title,issue.summary,issue.number]));
  return <>
    <div className="archive-tools"><h2>أرشيف الأعداد <span>({formatNumber(issues.length)})</span></h2><label className="filter-search"><Search size={17}/><input value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}} placeholder="ابحث بالعنوان أو رقم العدد..." aria-label="البحث في الأعداد"/></label></div>
    <ActiveFilters filters={[search&&{key:'q',label:'البحث: '+search,onRemove:()=>{setSearch('');setPage(1);}}]} onClear={()=>{setSearch('');setPage(1);}}/>
    <div className="results-line" aria-live="polite"><span>الأعداد المطابقة: {formatNumber(results.length)}</span></div>
    <div className="issue-grid">{results.slice((page-1)*12,page*12).map(issue=><ContentSurface kind="issue" className="issue-card" key={issue.id}>
      <Link href={'/magazine/'+issue.slug} className="issue-card-open"><div className="issue-cover">{issue.cover_url?<Image src={issue.cover_url} alt={'غلاف '+issue.title} fill sizes="(max-width:600px) 42vw, (max-width:1000px) 30vw, 240px" unoptimized={!canOptimizeImage(issue.cover_url)}/>:<BookOpen size={40}/>}<span className="issue-card-number">العدد {formatNumber(issue.number)}</span></div><div className="issue-card-content"><time className="issue-date" dateTime={issue.issue_date}><CalendarDays size={14}/>{formatArabicDate(issue.issue_date)}</time><h3>{issue.title}</h3>{downloadCountLabel(issue.downloads)&&<span className="issue-downloads">{downloadCountLabel(issue.downloads)}</span>}<span className="issue-open">قراءة العدد <ArrowUpLeft size={17}/></span></div></Link>
      {!issue.is_demo&&<div className="card-save-action"><SaveForLater compact item={{kind:'issue',href:'/magazine/'+encodeURIComponent(issue.slug),title:issue.title}}/></div>}
    </ContentSurface>)}</div>
    {!results.length&&<div className="empty-state"><BookOpen size={28}/><h3>لا توجد أعداد مطابقة لبحثك.</h3><button className="btn btn-outline" onClick={()=>{setSearch('');setPage(1);}}>مسح البحث</button></div>}
    <Pagination page={page} count={results.length} onChange={setPage}/>
  </>;
}