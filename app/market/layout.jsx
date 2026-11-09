import {notFound} from 'next/navigation';
import {getSiteSettings} from '@/lib/data';
import {sectionGate} from '@/lib/pageVisibility';

// «سوق 967» is a hidden section until the owner launches it (lib/pageVisibility.js, defaultHidden).
export default async function MarketLayout({children}){
 if(!sectionGate('market',await getSiteSettings()))notFound();
 return children;
}
