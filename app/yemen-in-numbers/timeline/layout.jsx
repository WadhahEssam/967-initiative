import '@/app/legacy/yemen-in-numbers--timeline.css';
import '@/app/interior-design.css';

// Not redesigned yet: legacy stylesheet bundle and interior wrapper, as before.
export default function LegacyStatisticsLayout({children}) { return <div className="interior-page" data-area="statistics">{children}</div>; }
