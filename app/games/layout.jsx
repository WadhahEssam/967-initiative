import '@/app/legacy/games.css';
import PublicPageBoundary from '@/components/design/PublicPageBoundary';

// Keep the same server-side visibility rule for this section and all descendants.
export default function SectionLayout({children}){
  return <PublicPageBoundary section="games">{children}</PublicPageBoundary>;
}