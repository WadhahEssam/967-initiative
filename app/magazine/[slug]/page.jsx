import ContextBackLink from '@/components/ContextBackLink';
export const dynamic='force-dynamic';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {CalendarDays,BookOpen} from 'lucide-react';
import {getIssue} from '@/lib/data';
import {formatArabicDate,formatNumber} from '@/lib/format';
import PdfReader from '@/components/PdfReader';
import InlineTarget from '@/components/inline/InlineTarget';
import {detailPath, pageMetadata} from '@/lib/seo';
import {breadcrumbSchema, issueSchema, JsonLd} from '@/lib/seo-schema';
import CorrectionLink from '@/components/CorrectionLink';
import ContentReadingAction from '@/components/reading/ContentReadingAction';
import {downloadCountLabel,issueDownloadPath} from '@/lib/issueDownloads';
import {readIssueDownloads} from '@/lib/issueDownloadsServer';
export async function generateMetadata({params}){const {slug}=await params;const issue=await getIssue(slug);if(!issue)notFound();return pageMetadata({title:issue.title, description:issue.summary, path:detailPath('magazine', issue.slug), image:issue.cover_url, noindex:issue.is_demo});}
export default async function IssuePage({params}){const {slug}=await params,issue=await getIssue(slug);if(!issue)notFound();const downloads=issue.is_demo?'':downloadCountLabel((await readIssueDownloads([issue.id])).get(issue.id));return <>
 <InlineTarget kind="issue" id={issue.id} slug={issue.slug} title={issue.title} href={detailPath('magazine',issue.slug)} isDemo={issue.is_demo}/>
 <JsonLd data={issueSchema(issue)}/><JsonLd data={breadcrumbSchema([{name:'مجلة 967', path:'/magazine'}, {name:issue.title, path:detailPath('magazine', issue.slug)}])}/>
 <section className="reader-intro"><div className="container"><ContextBackLink fallback="/magazine" label="العودة إلى أرشيف المجلة"/><span className="eyebrow">{issue.is_demo?'نسخة استعراضية — ليست عدداً رسمياً':`مجلة 967 / العدد ${formatNumber(issue.number)}`}</span><h1>{issue.title}</h1><p>{issue.summary}</p><span className="issue-date"><CalendarDays size={16}/>{formatArabicDate(issue.issue_date+'T12:00:00')}</span>{downloads&&<span className="issue-downloads">{downloads}</span>}</div></section>
 <section className="reader-section"><div className="container"><ContentReadingAction kind="issue" href={detailPath('magazine',issue.slug)} title={issue.title}/>{issue.pdf_url?<PdfReader url={issue.pdf_url} title={issue.title} downloadHref={issue.is_demo?issue.pdf_url:issueDownloadPath(issue.slug)}/>:<div className="reader-unavailable" role="status"><BookOpen size={28} aria-hidden="true"/><h2>ملف العدد غير متاح حالياً</h2><p>يمكنك العودة إلى أرشيف المجلة واختيار عدد آخر، أو المحاولة لاحقاً.</p><Link href="/magazine" className="btn btn-outline">العودة إلى أرشيف المجلة</Link></div>}<CorrectionLink title={issue.title} path={detailPath('magazine',issue.slug)} id={issue.id}/></div></section>
 </>}
