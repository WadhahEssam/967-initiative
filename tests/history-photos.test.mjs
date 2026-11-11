import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {historyStarter} from '../lib/yemenHistory.js';
import {historyPhotoLibrary,getHistoryPhotos,historyPhotoSource,historyPhotoPage} from '../lib/historyVisuals.js';
import {validateHistoryEntry,mergeHistoryCatalog} from '../lib/historyRepository.js';

test('all historical topics receive context-labeled referenced photographs, across six eras',()=>{
 assert.ok(historyStarter.length>=177);
 assert.ok(Object.keys(historyPhotoLibrary).length>=20);
 const coverage=new Map();
 const slugs=new Set();
 for(const entry of historyStarter){
  slugs.add(entry.slug);
  const photos=getHistoryPhotos(entry);
  assert.ok(photos.length>=1 && photos.length<=2,entry.slug);
  for(const photo of photos){
   assert.equal(photo.kind,'context',entry.slug+' must not present photos as contemporaneous evidence');
   assert.ok(photo.caption.length>=20,entry.slug);
   assert.ok(photo.credit.length>=3,entry.slug);
   assert.ok(photo.license,entry.slug);
   assert.ok(/^https:\/\/commons\.wikimedia\.org\/(wiki\/Special:FilePath\/|w\/index\.php\?title=Special:Redirect\/file\/)/.test(historyPhotoSource(photo)),entry.slug);
   assert.ok(historyPhotoPage(photo).startsWith('https://commons.wikimedia.org/wiki/File:'),entry.slug);
  }
  coverage.set(entry.era,(coverage.get(entry.era)||0)+1);
 }
 assert.equal(slugs.size,historyStarter.length);
 assert.equal(coverage.size,6);
 assert.equal(getHistoryPhotos({slug:'x',era:'modern',hideImages:true}).length,0);
});
test('licensed admin overrides can customize galleries and keep edits after merge',()=>{
 const entry=historyStarter[0];
 const photo={file:'Yemen protest.jpg',caption:'احتجاجات صنعاء عام 2011 كما وثقتها الصورة',credit:'Sallam from Yemen',license:'CC BY-SA 2.0'};
 const valid=validateHistoryEntry({...entry,images:[photo],hideImages:false});
 assert.equal(valid.images.length,1);
 assert.equal(getHistoryPhotos(valid)[0].file,photo.file);
 assert.ok(getHistoryPhotos(valid)[0].license);
 assert.equal(mergeHistoryCatalog([valid]).find(x=>x.slug===entry.slug).images.length,1);
 assert.equal(getHistoryPhotos(validateHistoryEntry({...entry,images:[photo],hideImages:true})).length,0);
 const invalid=[{file:'../hidden.jpg',caption:photo.caption,credit:photo.credit,license:photo.license},
 {file:'https://unsafe.example/image.jpg',caption:photo.caption,credit:photo.credit,license:photo.license},
 {file:photo.file,caption:photo.caption,credit:'',license:photo.license},
 {file:photo.file,caption:photo.caption,credit:photo.credit,license:''}];
 for(const bad of invalid)assert.throws(()=>validateHistoryEntry({...entry,images:[bad]}));
 assert.throws(()=>validateHistoryEntry({...entry,images:Array.from({length:9},()=>photo)}));
});
test('image slots are present in articles, catalogue, timeline and editor',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 assert.ok(read('app/yemen-history/[slug]/page.jsx').includes('<HistoryMedia entry={item}/>'));
 assert.ok(read('components/history/HistoryExplorer.jsx').includes('variant="thumbnail"'));
 assert.ok(read('components/history/HistoryTimeline.jsx').includes('variant="spotlight"'));
 const editor=read('components/HistoryAdminPanel.jsx');
 assert.ok(editor.includes('صور المادة'));
 assert.ok(editor.includes('ويكيميديا كومنز'));
 assert.ok(editor.includes('hideImages'));
 const gallery=read('components/history/HistoryMedia.jsx');
 assert.ok(gallery.includes('مصدر الصورة')||gallery.includes('المصدر'));
 assert.ok(gallery.includes('photo.credit'));
 assert.ok(gallery.includes("photo.kind==='direct'"));
 assert.ok(gallery.includes('صورة سياقية'));
});
