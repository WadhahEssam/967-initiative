import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';

// A loading.jsx under /market made the server send the skeleton first and the listings at the
// end of the HTML whenever the data was not ready at once; on a slow connection the browser then
// found the first photos about two seconds later (LCP about 2 s versus 6 s, measured 2026-11-09).
test('market pages send their listings in the first HTML, without a loading boundary',()=>{
 for(const file of ['app/market/loading.jsx','app/market/[number]/loading.jsx','app/market/search/loading.jsx','app/market/seller/[id]/loading.jsx'])
  assert.ok(!existsSync(new URL('../'+file,import.meta.url)),file);
});

// With a loading boundary the browser shows the page only once its whole HTML has arrived. On the
// ranking page (about 120 KB compressed) that kept the skeleton up for about 10 s on slow 4G
// (measured 2026-11-10); without it the page paints as it streams. Small pages may keep one.
test('large data pages stream their content without a loading boundary',()=>{
 for(const file of ['app/yemen-ranking/loading.jsx','app/yemen-in-numbers/timeline/loading.jsx','app/yemen-in-numbers/loading.jsx','app/yemen-history/loading.jsx','app/yemeni-figures/loading.jsx','app/universities/loading.jsx','app/medical-centers/loading.jsx'])
  assert.ok(!existsSync(new URL('../'+file,import.meta.url)),file);
});
