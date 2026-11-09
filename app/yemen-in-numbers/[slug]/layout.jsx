import '@/app/legacy/yemen-in-numbers--slug.css';
import '@/app/interior-design.css';

// Not redesigned yet: legacy stylesheet bundle and interior wrapper, as before.
export default function LegacyStatisticsLayout({children}) { return <div className="interior-page" data-area="statistics">{children}</div>; }
