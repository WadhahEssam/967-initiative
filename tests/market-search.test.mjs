import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ALL_YEMEN,describeFilters,listingMatches,parseFilters,queryGroups,savedFilters,searchHref,suggestions,textHasWord} from '../lib/market/search.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const places={isGovernorate:id=>['YE13','YE24'].includes(id),districtGovernorate:id=>({YE1301:'YE13',YE2404:'YE24'})[id]||null};

test('a query becomes groups of spellings: synonyms, catalogue names and Arabic forms',()=>{
 const groups=queryGroups('جوال سامسونج للبيع');
 assert.equal(groups.length,2,'«للبيع» says nothing about the item');
 assert.ok(groups[0].includes('موبايل')&&groups[0].includes('تلفون'));
 assert.ok(groups[1].includes('سامسونغ'));
 assert.ok(queryGroups('hilux')[0].includes('هايلكس'),'English model names find Arabic listings');
 assert.ok(queryGroups('هيلوكس')[0].includes('هايلكس'));
 assert.ok(queryGroups('تويوتا')[0].includes('toyota'));
 assert.deepEqual(queryGroups('لاب توب')[0].slice(0,1),['لابتوب'],'two-word names are joined');
 assert.ok(queryGroups('السيارة')[0].includes('سياره'),'«ال» is optional and ة/ه are one letter');
 assert.ok(queryGroups('شقّة')[0].includes('شقه'),'diacritics are ignored');
 assert.equal(queryGroups('').length,0);
 assert.ok(queryGroups('a b c d e f g h').length<=6);
});

test('words match from the start of a word, also after ال/و/ب/ل',()=>{
 const text='تويوتا هايلكس 2015 للبيع السياره نظيفه جوالات';
 assert.ok(textHasWord(text,'هايلكس'));
 assert.ok(textHasWord(text,'سياره'),'after «ال»');
 assert.ok(textHasWord(text,'جوال'),'a word that starts with it');
 assert.ok(!textHasWord('كلاب للبيع','لاب'),'not inside another word');
});

test('search filters accept only known values',()=>{
 const f=parseFilters(new URLSearchParams('q=  جوال  سامسونج &category=electronics&sub=phones&gov=YE24&district=YE2404&currency=USD&min=٣٠٠&max=100&condition=used&sort=price_asc&page=2'),places);
 assert.deepEqual(f,{q:'جوال سامسونج',category:'electronics',sub:'phones',gov:'YE24',district:'YE2404',currency:'USD',min:100,max:300,condition:'used',sort:'price_asc',page:2});
 assert.deepEqual(parseFilters({category:'weapons',sub:'x',gov:'YE99',condition:'broken',sort:'random',page:'999'},places),{});
 assert.deepEqual(parseFilters({min:'100',max:'200'},places),{},'a price range needs a currency');
 assert.deepEqual(parseFilters({gov:'YE13',district:'YE2404'},places),{gov:'YE13'},'a district must be in the governorate');
 assert.deepEqual(parseFilters({sub:'phones'},places),{},'a section needs its category');
});

test('the visitor\'s governorate is used when the address has none, and stays out of links',()=>{
 const own=parseFilters({q:'هايلكس'},places,'YE24');
 assert.deepEqual(own,{q:'هايلكس',gov:'YE24',fromHome:true});
 assert.equal(searchHref(own),'/market/search?q='+encodeURIComponent('هايلكس'));
 assert.equal(searchHref(own,{gov:ALL_YEMEN}),'/market/search?q='+encodeURIComponent('هايلكس')+'&gov=all');
 assert.deepEqual(parseFilters({gov:'all'},places,'YE24'),{gov:ALL_YEMEN});
 assert.equal(searchHref({category:'vehicles',sort:'new',page:1}),'/market/search?category=vehicles');
 assert.equal(searchHref({category:'vehicles'},{page:3}),'/market/search?category=vehicles&page=3');
});

test('saved searches keep the filters and get a readable name',()=>{
 const filters={q:'هايلكس',category:'vehicles',sub:'cars',gov:'YE24',currency:'USD',max:9000,sort:'price_asc',page:2,fromHome:true};
 assert.deepEqual(savedFilters(filters),{q:'هايلكس',category:'vehicles',sub:'cars',gov:'YE24',currency:'USD',max:9000});
 assert.deepEqual(savedFilters({gov:ALL_YEMEN}),{});
 assert.equal(describeFilters(savedFilters(filters),{governorate:'عدن'}),'«هايلكس» · سيارات · عدن · حتى 9,000 $');
 assert.equal(describeFilters({}),'كل الإعلانات');
});

test('new listings are matched against saved searches',()=>{
 const listing={category:'vehicles',subcategory:'cars',governorate_id:'YE24',district_id:'YE2404',condition:'used',currency:'USD',price:8500,search_text:'تويوتا هايلكس 2015 سيارات'};
 assert.ok(listingMatches({q:'hilux',gov:'YE24',currency:'USD',max:9000},listing));
 assert.ok(listingMatches({q:'سيارة تويوتا'},listing));
 assert.ok(!listingMatches({q:'برادو'},listing));
 assert.ok(!listingMatches({currency:'USD',max:8000},listing));
 assert.ok(!listingMatches({gov:'YE13'},listing));
 assert.ok(listingMatches({gov:ALL_YEMEN,sub:'cars'},listing));
});

test('suggestions come from sections, brands and car models',()=>{
 assert.ok(suggestions('هاي').some(item=>item.text==='هايلكس'));
 assert.ok(suggestions('سامس').some(item=>item.text==='سامسونج'));
 const sections=suggestions('جوالات');
 assert.ok(sections[0].href?.includes('sub=phones'),'a section opens its search page');
 assert.equal(suggestions('ه').length,0,'at least two letters');
 assert.ok(suggestions('تويوتا هاي').some(item=>item.text==='تويوتا هايلكس'),'earlier words are kept');
});

test('favourites, saved searches and misses are private; search is for the server only',()=>{
 const sql=read('supabase/migrations/20261109160000_market_search.sql');
 assert.match(sql,/revoke all on public\.market_favourites,public\.market_saved_searches,public\.market_search_misses from anon,authenticated/);
 for(const name of ['market_favourites','market_saved_searches','market_search_misses'])assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
 assert.match(sql,/revoke all on function public\.market_search\([^)]*\) from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.market_search\([^)]*\) to service_role/);
 assert.match(sql,/revoke all on function public\.market_log_miss\(text\) from public,anon,authenticated/);
 assert.match(sql,/p\.suspended or p\.deletion_requested_at is not null/,'suspended sellers are left out');
 assert.match(sql,/l\.status in \('active','reserved'\)/);
 assert.match(sql,/-'views'-'saves'-'updated_at'-'revision'/,'saves do not count as edits');
 const server=read('lib/market/searchServer.js');
 assert.match(server,/MAX_SAVED_SEARCHES=20/);
 assert.match(server,/seller_id===user\.id/,'members cannot save their own listing');
});
