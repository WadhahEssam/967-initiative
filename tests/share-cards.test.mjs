import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initWasm,Resvg} from '@resvg/resvg-wasm';
import {SHARE_CARD_FONT,cleanText,escapeXml,lineRuns,shareAccents,shareCardKinds,shareCardPath,shareCardSvg,shareCardVersion,wrapText} from '../lib/shareCard.js';
import {pageMetadata} from '../lib/seo.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fakeMeasure=(text,size)=>text.length*size*.5;

test('text is wrapped by width, limited in lines, and cut with an ellipsis',()=>{
 const lines=wrapText('كلمة '.repeat(60),{maxWidth:300,maxLines:3,size:20,measure:fakeMeasure});
 assert.equal(lines.length,3);
 assert.ok(lines.every(line=>fakeMeasure(line,20)<=300));
 assert.ok(lines[2].endsWith('…'));
 assert.deepEqual(wrapText('قصير',{maxWidth:300,maxLines:2,size:20,measure:fakeMeasure}),['قصير']);
 assert.deepEqual(wrapText('',{maxWidth:300,maxLines:2,size:20,measure:fakeMeasure}),[]);
});

test('card text is cleaned and escaped',()=>{
 assert.equal(cleanText('وادٍ  جبلي‏'),'واد جبلي');
 assert.equal(escapeXml('<a & "b">'),'&lt;a &amp; &quot;b&quot;&gt;');
 const svg=shareCardSvg({title:'<script>',description:'x & y'},{measure:fakeMeasure});
 assert.ok(!svg.includes('<script>'));
 assert.ok(svg.includes('&lt;script&gt;'));
});

test('Arabic lines are right-to-left, number-only lines left-to-right',()=>{
 const svg=shareCardSvg({kicker:'تاريخ اليمن',title:'ثورة سبتمبر',accent:shareAccents.history,art:{type:'big',text:'893 – 945',label:'العصر العباسي'}},{measure:fakeMeasure});
 assert.match(svg,/direction="rtl"[^>]*>‏ثورة سبتمبر‏</);
 assert.match(svg,/direction="ltr"[^>]*>‎893 – 945‎</);
 assert.ok(svg.includes(shareAccents.history));
});

test('share card paths are limited to known kinds and change with the content',()=>{
 assert.equal(shareCardPath('unknown','x'),null);
 assert.equal(shareCardPath('district',''),null);
 assert.equal(shareCardPath('district','YE1704'),'/share/district/YE1704');
 const a=shareCardPath('history','saba','سبأ','نص'),b=shareCardPath('history','saba','سبأ','نص معدل');
 assert.ok(a.startsWith('/share/history/saba?v=')&&a!==b);
 assert.equal(shareCardVersion('x'),shareCardVersion('x'));
 assert.ok(shareCardKinds.includes('course'));
});

test('page metadata gives share cards their real size',()=>{
 const env={NEXT_PUBLIC_SITE_URL:'https://967ye.com',NODE_ENV:'production'};
 const card=pageMetadata({title:'مديرية عبس',path:'/yemen-map/districts/YE1704',image:'/share/district/YE1704?v=1'},env);
 assert.equal(card.openGraph.images[0].url,'https://967ye.com/share/district/YE1704?v=1');
 assert.equal(card.openGraph.images[0].width,1200);
 assert.equal(card.twitter.images[0],'https://967ye.com/share/district/YE1704?v=1');
 const plain=pageMetadata({title:'صفحة',path:'/x'},env);
 assert.equal(plain.openGraph.images[0].width,undefined);
});

test('the real renderer draws an Arabic card as a 1200×630 PNG',async()=>{
 await initWasm(readFileSync(new URL('../node_modules/@resvg/resvg-wasm/index_bg.wasm',import.meta.url)));
 const fonts=['Regular','SemiBold'].map(weight=>readFileSync(new URL('../lib/shareCard/IBMPlexSansArabic-'+weight+'.ttf',import.meta.url)));
 const options={font:{fontBuffers:fonts,defaultFontFamily:SHARE_CARD_FONT,loadSystemFonts:false}};
 const measure=(text,size,weight=400)=>{const r=new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="300"><text x="10" y="150" font-family="${SHARE_CARD_FONT}" font-weight="${weight}" font-size="${size}">${escapeXml(text)}</text></svg>`,options);try{return r.getBBox()?.width||0;}finally{r.free();}};
 assert.ok(measure('صنعاء القديمة',30)>measure('صنعاء',30));
 const svg=shareCardSvg({kicker:'خريطة اليمن',title:'مديرية صنعاء القديمة',subtitle:'محافظة أمانة العاصمة',description:'نص تجريبي قصير.',art:{type:'big',text:'2 كم²'}},{measure});
 const resvg=new Resvg(svg,options),png=Buffer.from(resvg.render().asPng());resvg.free();
 assert.deepEqual([...png.subarray(1,4)],[...Buffer.from('PNG')]);
 assert.equal(png.readUInt32BE(16),1200);
 assert.equal(png.readUInt32BE(20),630);
});

test('detail pages point their share image at the card route',()=>{
 for(const [file,kind] of [['app/yemen-map/districts/[id]/page.jsx','district'],['app/yemen-map/governorates/[id]/page.jsx','governorate'],['app/yemen-history/[slug]/page.jsx','history'],['app/yemeni-figures/[slug]/page.jsx','figure'],['app/yemen-in-numbers/indicator/[slug]/page.jsx','indicator'],['app/universities/[slug]/page.jsx','university'],['app/medical-centers/[slug]/page.jsx','medical'],['app/yemeni-products/[id]/page.jsx','company'],['app/school/courses/[slug]/page.jsx','course']])
  assert.ok(read(file).includes(`shareCardPath('${kind}'`),file);
 const route=read('app/share/[kind]/[id]/route.js');
 assert.ok(route.includes('shareCardKinds.includes(kind)')&&route.includes("'Content-Type':'image/png'"));
 const server=read('lib/shareCardServer.js');
 for(const section of ["'atlas'","'history'","'school'"])assert.ok(server.includes('sectionIsVisible('+section),section);
});

test('a right-aligned Arabic line with Latin words is split into runs placed from the right',()=>{
 assert.deepEqual(lineRuns('رصد الخدمات (HeRAMS) التابعة لمنظمة'),[{latin:false,text:'رصد الخدمات'},{latin:true,text:'(HeRAMS)'},{latin:false,text:'التابعة لمنظمة'}]);
 const svg=shareCardSvg({title:'مستشفى',description:'منظومة الخدمات الصحية (HeRAMS) التابعة لمنظمة الصحة'},{measure:fakeMeasure});
 const runs=[...svg.matchAll(/<text x="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].filter(([, ,text])=>/HeRAMS|منظومة|التابعة/.test(text));
 assert.equal(runs.length,3);
 assert.ok(Number(runs[0][1])>Number(runs[1][1])&&Number(runs[1][1])>Number(runs[2][1]),'runs go right to left');
});
