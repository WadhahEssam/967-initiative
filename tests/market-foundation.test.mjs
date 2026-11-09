import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import sharp from 'sharp';
import {CAR_BRANDS,CAR_MODELS,CATEGORIES,CONDITIONS,CURRENCIES,findSubcategory} from '../lib/market/catalog.js';
import {ListingError,listingCompleteness,listingHighlights,listingSearchText,suggestTitle,validateListing} from '../lib/market/listing.js';
import {prohibitedMatches,reviewReason} from '../lib/market/moderation.js';
import {normalizeSearch,westernDigits} from '../lib/market/text.js';
import {ImageError,processListingImage} from '../lib/market/images.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const places={isGovernorate:id=>['YE13','YE15'].includes(id),districtGovernorate:id=>({YE1301:'YE13',YE1501:'YE15'})[id]||null};
const car=(extra={})=>({category:'vehicles',subcategory:'cars',price:'٨٬٥٠٠',currency:'USD',condition:'used',governorate_id:'YE13',district_id:'YE1301',
 attributes:{body:'pickup',brand:'toyota',model:'hilux',year:2015,mileage_km:'120,000',transmission:'automatic',fuel:'diesel'},...extra});

test('the catalogue follows the spec: 10 categories, unique keys, consistent fields',()=>{
 assert.equal(CATEGORIES.length,10);
 assert.equal(CURRENCIES.length,5);
 assert.deepEqual(CONDITIONS.map(item=>item.value),['new','like_new','used','needs_repair']);
 assert.equal(new Set(CATEGORIES.map(item=>item.key)).size,10);
 for(const category of CATEGORIES){
  assert.equal(new Set(category.subcategories.map(item=>item.key)).size,category.subcategories.length,category.key);
  for(const sub of category.subcategories){
   const keys=sub.fields.map(field=>field.key);
   assert.equal(new Set(keys).size,keys.length,sub.key);
   for(const key of [...sub.titleFrom,...sub.highlights])assert.ok(keys.includes(key),sub.key+'.'+key);
   for(const field of sub.fields.filter(item=>item.type==='select'))assert.ok(field.options.length>=2,sub.key+'.'+field.key);
  }
 }
 for(const brand of Object.keys(CAR_MODELS))assert.ok(CAR_BRANDS.some(item=>item.value===brand),brand);
 assert.ok(CAR_BRANDS.every(item=>CAR_MODELS[item.value]?.length>=4),'every car brand has its common models');
});

test('a complete car listing is accepted, normalised and titled «تويوتا هايلكس 2015»',()=>{
 const listing=validateListing(car(),{complete:true,places});
 assert.equal(listing.price,8500,'Arabic digits and separators');
 assert.equal(listing.attributes.mileage_km,120000);
 assert.equal(listing.title,'تويوتا هايلكس 2015');
 assert.deepEqual(listingHighlights(listing),['2015','120,000 كم','أوتوماتيك','ديزل']);
 assert.ok(listingCompleteness(listing)>0&&listingCompleteness(listing)<100);
 assert.ok(listingSearchText(listing).includes('تويوتا هايلكس 2015'));
 assert.ok(listingSearchText(listing).includes('مركبات'));
});

test('publishing asks for every required field; a draft does not',()=>{
 const missing=car({attributes:{body:'pickup',brand:'toyota',model:'hilux'}});
 assert.throws(()=>validateListing(missing,{complete:true,places}),error=>error instanceof ListingError&&error.field==='year');
 assert.equal(validateListing(missing,{places}).attributes.model,'hilux');
 assert.throws(()=>validateListing(car({price:''}),{complete:true,places}),error=>error.field==='price');
 assert.throws(()=>validateListing(car({district_id:'YE1501'}),{complete:true,places}),error=>error.field==='district_id','district outside the governorate');
 assert.throws(()=>validateListing(car({attributes:{...car().attributes,engine:'x'}}),{places}),error=>error.field==='attributes','unknown attribute');
 assert.throws(()=>validateListing(car({attributes:{...car().attributes,body:'boat'}}),{places}),error=>error.field==='body');
 assert.throws(()=>validateListing({category:'vehicles',subcategory:'boats'},{places}),error=>error.field==='category');
});

test('«أخرى» needs a typed brand or model, and brands without a model list take a typed model',()=>{
 assert.throws(()=>validateListing(car({attributes:{...car().attributes,brand:'other',model:'other'}}),{complete:true,places}),error=>error.field==='brand');
 const byd=validateListing(car({attributes:{...car().attributes,brand:'other',brand_other:'بي واي دي',model:'other',model_other:'F3'}}),{complete:true,places});
 assert.equal(suggestTitle(byd),'بي واي دي F3 2015');
 const land=validateListing({category:'real_estate',subcategory:'land',price:1,currency:'YER_OLD',condition:'new',governorate_id:'YE15',district_id:'YE1501',attributes:{land_type:'residential',area:12,area_unit:'libna'}},{complete:true,places});
 assert.equal(land.title,'سكنية 12 لبنة');
});

test('prohibited content is held for review; whole words only',()=>{
 assert.equal(prohibitedMatches('مسدس للبيع نظيف')[0].reason,'سلاح أو ذخيرة');
 assert.equal(prohibitedMatches('جنبية صيفاني أصلية')[0].reason,'سلاح أو ذخيرة');
 assert.equal(prohibitedMatches('بيع القات البلدي')[0].reason,'قات');
 assert.equal(prohibitedMatches('مخطوطة قديمة نادرة')[0].reason,'آثار أو مخطوطات');
 assert.deepEqual(prohibitedMatches('ألواح طاقات شمسية 550 واط'),[],'«طاقات» is not «قات»');
 assert.deepEqual(prohibitedMatches('تويوتا هايلكس 2015 نظيفة'),[]);
 assert.match(reviewReason(prohibitedMatches('بندقية صيد')),/سلاح أو ذخيرة/);
});

test('search text has one spelling for Arabic variants and Arabic-Indic digits',()=>{
 assert.equal(westernDigits('٢٠١٥ و۱۲۳'),'2015 و123');
 assert.equal(normalizeSearch('تويوتا هايلَكس ـ٢٠١٥ للبيعـ! آلة إبرة مُستشفى'),'تويوتا هايلكس 2015 للبيع اله ابره مستشفي');
});

test('photos are re-encoded: turned upright, GPS and all metadata removed, two WebP sizes',async()=>{
 const original=await sharp({create:{width:2400,height:1600,channels:3,background:'#c84'}}).jpeg()
  .withExif({IFD0:{Make:'TestPhone'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'15/1 21/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'44/1 12/1 0/1'}}).withMetadata({orientation:6}).toBuffer();
 const before=await sharp(original).metadata();
 assert.ok(before.exif,'the test photo carries EXIF');
 const out=await processListingImage(original);
 const full=await sharp(out.full).metadata(),thumb=await sharp(out.thumb).metadata();
 assert.equal(full.format,'webp');
 assert.equal(full.exif,undefined,'no EXIF, so no GPS');
 assert.equal(full.orientation,undefined);
 assert.equal(full.width,853);assert.equal(full.height,1280,'orientation 6 is turned upright');
 assert.ok(Math.max(thumb.width,thumb.height)<=480);
 await assert.rejects(processListingImage(Buffer.from('not an image')),ImageError);
 await assert.rejects(processListingImage(await sharp({create:{width:100,height:100,channels:3,background:'#fff'}}).png().toBuffer()),ImageError);
});

test('the market starts hidden; the database allows reads of published listings only',()=>{
 const sql=read('supabase/migrations/20261109140000_market_foundation.sql');
 assert.match(sql,/alter table public\.market_listings enable row level security;/);
 assert.match(sql,/alter table public\.market_uploads enable row level security;/);
 assert.match(sql,/revoke all on public\.market_listings,public\.market_uploads from anon,authenticated;/);
 assert.match(sql,/grant select on public\.market_listings to anon,authenticated;/);
 assert.doesNotMatch(sql,/grant (insert|update|delete)/);
 assert.match(sql,/status in \('active','reserved'\) or \(status='sold' and sold_at>now\(\)-interval '2 days'\)/);
 assert.match(read('lib/pageVisibility.js'),/\{id:'market',path:'\/market',title:'سوق 967',defaultHidden:true\}/);
});

test('uploads need a market member, go to tmp/, and are served from a disk cache',()=>{
 const upload=read('app/api/market/images/route.js'),serve=read('app/api/market/img/[id]/[size]/route.js'),access=read('lib/market/access.js');
 assert.ok(upload.includes('await marketMember(request)')&&upload.includes("imageKey(id,'full',{temporary:true})"));
 assert.ok(upload.includes('count>=DAILY_UPLOADS'));
 assert.doesNotMatch(upload,/^export const (?!dynamic|runtime)/m,'route files export only route fields');
 assert.ok(access.includes("if(!['admin','management'].includes(editor?.role))"),'editors only while hidden');
 assert.ok(serve.includes("'public, max-age=31536000, immutable'")&&serve.includes('rename(temporary,file)'));
 assert.ok(read('lib/market/uploads.js').includes(".eq('owner_id',ownerId)"),'only the owner\'s uploads can be attached');
});

test('«الحالة» is required for goods and optional for property and animals',()=>{
 assert.throws(()=>validateListing(car({condition:null}),{complete:true,places}),error=>error.field==='condition');
 const base={price:'1000',currency:'YER_OLD',governorate_id:'YE15',district_id:'YE1501'};
 const land=validateListing({...base,category:'real_estate',subcategory:'land',attributes:{land_type:'residential',area:4,area_unit:'libna'}},{complete:true,places});
 assert.equal(land.condition,null);
 const sheep=validateListing({...base,category:'animals',subcategory:'livestock',attributes:{type:'sheep',count:10}},{complete:true,places});
 assert.equal(sheep.condition,null);
 assert.equal(validateListing({...base,category:'animals',subcategory:'livestock',condition:'new',attributes:{type:'sheep',count:10}},{complete:true,places}).condition,'new','a seller may still choose one');
 assert.throws(()=>validateListing({...base,category:'animals',subcategory:'livestock',condition:'broken',attributes:{type:'sheep',count:10}},{complete:true,places}),/حالة المنتج/);
});
