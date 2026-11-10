import {notFound} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionAccess} from '@/lib/sectionPreview';
import MarketBlockFilter from '@/components/market/MarketBlockFilter';
import SectionPreviewNote from '@/components/SectionPreviewNote';

// «سوق 967» is a hidden section until the owner launches it (lib/pageVisibility.js, defaultHidden).
// Editors can open it before then through the preview cookie (lib/sectionPreview.js).
export default async function MarketLayout({children}){
 const access=await sectionAccess('market',await getSiteSettings());
 if(!access)notFound();
 return <>{access==='preview'&&<div className="ed-wrap"><SectionPreviewNote/></div>}{children}<MarketBlockFilter/></>;
}
