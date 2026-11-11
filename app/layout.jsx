// Root loads only fonts, tokens, base and the shell. Route styles belong to routes;
// routes that are not redesigned yet import '@/app/legacy-styles' in their layout.
import './fonts.css';
import './foundation/tokens.css';
import './foundation/base.css';
import './foundation/shell.css';
import './foundation/editorial.css';
import './foundation/unified.css';
import './foundation/identity.css';
import './foundation/knowledge.css';
import './foundation/sections.css';
import {site} from '@/lib/config';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {getSiteSettings} from '@/lib/data';
import {getMemberCount} from '@/lib/memberCount';
import {getSiteOrigin, pageMetadata} from '@/lib/seo';
import {JsonLd, siteSchema} from '@/lib/seo-schema';
import {contentPagePath} from '@/lib/contentPages';
import InlineEditorProvider from '@/components/inline/InlineEditorProvider';
import OperationalMonitor from '@/components/OperationalMonitor';
import SiteUsageTracker from '@/components/analytics/SiteUsageTracker';
import NavigationMemory from '@/components/NavigationMemory';
import PageVisibilityProvider from '@/components/PageVisibilityProvider';
import {pageIsVisible} from '@/lib/pageVisibility';
export const dynamic='force-dynamic';

export const metadata = {
 ...pageMetadata({title:'مبادرة 967', description:site.description}),
 metadataBase:new URL(getSiteOrigin()),
 title:{default:'مبادرة 967 | صوت ومعرفة ومجتمع',template:'%s | مبادرة 967'},
 description:site.description,
 icons:{icon:'/icon-64.png',apple:'/apple-touch-icon.png'},
};
export default async function RootLayout({children}){
 const settings=await getSiteSettings();
 // The footer shows how many accounts exist; a failure only hides that line.
 const memberCount=await getMemberCount().catch(()=>null);
 // Dark is the default (owner, 2026-11-11); light only for a visitor who picked it.
 // Head script: the saved light choice before first paint, and a no-op catch on cross-document view
 // transitions, which reject with «Transition was skipped» when a navigation interrupts them. A slow
 // page can skip its transition before pagereveal runs, so that one rejection is also silenced.
 return <html lang="ar" dir="rtl" data-ed-theme="dark" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:"try{if(localStorage.getItem('967-editorial-theme')==='light')document.documentElement.dataset.edTheme='light'}catch(e){};['pagereveal','pageswap'].forEach(function(n){addEventListener(n,function(e){var v=e.viewTransition;if(v){['ready','finished','updateCallbackDone'].forEach(function(k){if(v[k]&&v[k].catch)v[k].catch(function(){})})}})});addEventListener('unhandledrejection',function(e){var r=e.reason;if(r&&r.name==='AbortError'&&/Transition was skipped/.test(r.message))e.preventDefault()})"}}/><link rel="preload" href="/fonts/plex-arabic-400-web.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/><link rel="preload" href="/fonts/markazi-arabic-web.woff2" as="font" type="font/woff2" crossOrigin="anonymous"/></head><body><OperationalMonitor/><NavigationMemory/><JsonLd data={siteSchema(settings)}/><a className="ed-skip" href="#content">انتقل إلى المحتوى</a><PageVisibilityProvider visibility={settings.pageVisibility} pages={(settings.contentPages||[]).map(({slug,isPublished})=>({slug,isPublished}))}><SiteUsageTracker/><InlineEditorProvider><Header actionLabel={settings.headerActionLabel} contentLinks={(settings.contentPages||[]).filter(page=>pageIsVisible(contentPagePath(page),settings.pageVisibility,settings.contentPages)).map(page=>({slug:page.slug,title:page.title,href:contentPagePath(page)}))}/><main id="content" className="visual-foundation site-experience">{children}</main><Footer settings={settings} memberCount={memberCount}/></InlineEditorProvider></PageVisibilityProvider></body></html>;
}
