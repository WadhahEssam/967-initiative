import DebateLogo from '@/components/debates/DebateLogo';
import ContextBackLink from '@/components/ContextBackLink';
import ContentReadingAction from '@/components/reading/ContentReadingAction';
import Image from 'next/image';
import Link from '@/components/SiteLink';
import {notFound} from 'next/navigation';
import {getDebateSpeaker} from '@/lib/debateServer';
import {pageMetadata} from '@/lib/seo';
import {httpsUrl} from '@/lib/debates';
import DebateCard from '@/components/debates/DebateCard';
import {memberProfilePath} from '@/lib/memberProfiles';
export async function generateMetadata({params}){const {slug}=await params,{data,available}=await getDebateSpeaker(slug);if(!available)throw new Error('Debate service unavailable');return pageMetadata({title:data?.speaker.name||'ملف المناظر',description:data?.speaker.bio,path:'/debates/speakers/'+slug,image:data?.speaker.photo_url||'/images/debates-logo.png',noindex:!data});}
export default async function Page({params}){const {slug}=await params,{data,available}=await getDebateSpeaker(slug);if(!available)throw new Error('Debate service unavailable');if(!data)notFound();const s=data.speaker;const memberPath=memberProfilePath(s.member_user_id)||memberProfilePath(s.id);return <div className="container debate-account"><ContextBackLink fallback="/debates" label="مناظرات 967" className="eyebrow debate-brand-link" leading={<DebateLogo decorative sizes="44px"/>}/><section className="debate-panel debate-speaker-profile">{httpsUrl(s.photo_url)&&<Image unoptimized width={960} height={540} referrerPolicy="no-referrer" src={httpsUrl(s.photo_url)} alt=""/>}<div><h1>{s.name}</h1><p>{s.specialty}</p><p className="debate-prose">{s.bio}</p><ContentReadingAction kind="speaker" href={'/debates/speakers/'+encodeURIComponent(s.slug)} title={s.name}/><div className="debate-actions">{memberPath&&<Link href={memberPath} className="btn btn-outline">{s.member_user_id?'الملف الشخصي للعضو في 967':'الملف الشخصي في 967 (تجريبي)'}</Link>}{s.social_links?.filter(l=>httpsUrl(l.url)).map((l,i)=><a key={i} href={httpsUrl(l.url)} target="_blank" rel="noopener noreferrer">{l.label||'رابط اجتماعي'}</a>)}</div></div></section><h2>مشاركات في الحوار</h2>{data.debates.length?<div className="debate-grid">{data.debates.map(d=><DebateCard key={d.id} debate={d}/>)}</div>:<p>لا توجد مناظرات منشورة لهذا المناظر بعد.</p>}</div>;}
