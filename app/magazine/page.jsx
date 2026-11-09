import Link from '@/components/SiteLink';
import Image from 'next/image';
import {BookOpen, Download, CalendarDays} from 'lucide-react';
import PageIntro from '@/components/PageIntro';
import SaveForLater from '@/components/reading/SaveForLater';
import IssueGrid from '@/components/IssueGrid';
import {getIssues} from '@/lib/data';
import {formatArabicDate,formatNumber} from '@/lib/format';
import {canOptimizeImage} from '@/lib/media';
import {pageMetadata} from '@/lib/seo';
import {downloadCountLabel,issueDownloadPath} from '@/lib/issueDownloads';
import {readIssueDownloads} from '@/lib/issueDownloadsServer';
export const dynamic='force-dynamic';
export const metadata = pageMetadata({title:'مجلة 967', description:'اقرأ أحدث إصدارات مجلة 967 واستكشف أرشيف الأعداد أو حمّل نسختك بصيغة PDF.', path:'/magazine'});
export default async function Magazine() {
  const listed=await getIssues(),downloads=await readIssueDownloads(listed.map(issue=>issue.id));
  const issues=listed.map(issue=>({...issue,downloads:downloads.get(issue.id)||0})),latest=issues[0];
  return <>
    <PageIntro tone="plum" title="صفحات من الحكاية اليمنية." category="مجلة 967" description="ملفات وقصص وأفكار تقرأها في وقتك. افتح العدد من المتصفح أو احتفظ بنسختك بصيغة PDF."/>
    {latest ? <section className="section latest-issue"><div className="container"><article className="issue-spotlight">
      <Link href={'/magazine/'+latest.slug} className="spotlight-cover" aria-label={'قراءة '+latest.title}>{latest.cover_url?<Image src={latest.cover_url} alt={'غلاف '+latest.title} width={450} height={600} priority sizes="(max-width:600px) 180px, 220px" unoptimized={!canOptimizeImage(latest.cover_url)}/>:<BookOpen size={55}/>}</Link>
      <div className="spotlight-copy"><span className="eyebrow">أحدث إصدار</span><span className="issue-number">العدد {formatNumber(latest.number)}</span><h2>{latest.title}</h2>{latest.summary&&<p>{latest.summary}</p>}<time className="spotlight-date" dateTime={latest.issue_date}><CalendarDays size={16}/>{formatArabicDate(latest.issue_date)}</time>{downloadCountLabel(latest.downloads)&&<span className="issue-downloads"><Download size={15}/>{downloadCountLabel(latest.downloads)}</span>}
        {Array.isArray(latest.contents)&&latest.contents.some(item=>typeof item==='string')&&<details className="issue-contents"><summary>داخل هذا العدد</summary><ul>{latest.contents.filter(item=>typeof item==='string').map(item=><li key={item}>{item}</li>)}</ul></details>}
        <div className="spotlight-actions"><Link className="btn btn-primary" href={'/magazine/'+latest.slug}>اقرأ العدد <BookOpen size={18}/></Link>{latest.pdf_url&&<a className="btn btn-outline" href={issueDownloadPath(latest.slug)} target="_blank" rel="noopener noreferrer">تحميل PDF <Download size={18}/></a>}{!latest.is_demo&&<SaveForLater compact item={{kind:'issue',href:'/magazine/'+encodeURIComponent(latest.slug),title:latest.title}}/>}</div>
      </div>
    </article></div></section> : <section className="section"><div className="container empty-state"><BookOpen size={34}/><h2>الإصدار القادم يبدأ من هنا.</h2><p>لم تُنشر أعداد في الأرشيف بعد.</p><Link href="/magazine/demo" className="btn btn-outline">جرّب القارئ بملف توضيحي</Link><p className="small-muted">الملف التوضيحي ليس عدداً منشوراً من المجلة.</p></div></section>}
    {issues.length>0&&<section className="section archive-section"><div className="container"><IssueGrid issues={issues}/></div></section>}
  </>;
}