import {commonsFileAt} from './media.js';
// Curated Wikimedia Commons photograph library.
// Every image has a transparent source page and creator credit. Photographs of
// ancient monuments are contemporary photographs, never images of ancient events.
const photo=(file,caption,creator,license='الترخيص والتفاصيل في صفحة الصورة')=>({
 file,caption,alt:caption,credit:creator,license
});
export const historyPhotoLibrary={
 marib:photo('Old Marib.JPG','موقع مأرب الأثري، تصوير حديث لبقايا المدينة القديمة','ويكيميديا كومنز'),
 barran:photo('Temple of Barran in Marib.jpg','معبد برآن الأثري في مأرب، تصوير حديث','يوسف حسين','ملكية عامة'),
 awam:photo('Awam Temple.jpg','معبد أوام في مأرب، تصوير حديث للموقع الأثري','ويكيميديا كومنز'),
 dam:photo('083 stari jez.jpg','بقايا منظومة سد مأرب التاريخي، تصوير حديث','ويكيميديا كومنز'),
 musnad:photo('Musnad script on a stone.jpg','نقش بالخط المسند، معروض بمتحف المكلا','Abo Yemen'),
 sana:photo("Old City of Sana'a-111119.jpg",'صنعاء القديمة كما تبدو في صورة فوتوغرافية معاصرة','اليونسكو / ويكيميديا كومنز'),
 sana2:photo("Old Sana'a City - Yemen.jpg",'منظر معاصر لعمارة صنعاء القديمة','Ibrahim Alqousi','CC BY-SA 4.0'),
 sanaOld:photo("Old City, Sana'a, Yemen (14461459280).jpg",'صنعاء القديمة، صورة التقطت في عام 2013م','Rod Waddington','CC BY-SA 2.0'),
 zabid:photo('Zabid, Yemen.jpg','أحد شوارع مدينة زبيد التاريخية، تصوير حديث','Ahron de Leeuw','CC BY 2.0'),
 shibam:photo('Shibam, Yemen 28.jpg','المباني الطينية المرتفعة في شبام حضرموت، تصوير حديث','Hasso Hohmann','CC BY 4.0'),
 shibam2:photo('Shibam Yemen Interior.jpg','أزقة وعمارة مدينة شبام حضرموت التاريخية','ويكيميديا كومنز'),
 arwa:photo('Jibla.jpg','مسجد الملكة أروى في جبلة، تصوير عام 1986م','Bernard Gagnon','CC BY-SA'),
 arwa2:photo('Queen Arwa Mosque - Jibla.jpg','مسجد الملكة أروى في جبلة، تصوير عام 2010م','yeowatzup','ترخيص موضح في صفحة الصورة'),
 taiz:photo('Yemeni castle in taiz.jpg','قلعة القاهرة في تعز كما تبدو في عام 2024م','Waseem350','CC0 1.0'),
 taiz2:photo('Taiz city from AlQahirah Castle.jpg','مدينة تعز من قلعة القاهرة، تصوير عام 2014م','SharabSalam','CC BY-SA 4.0'),
 shaharah:photo('Shaharah bridge.jpg','جسر شهارة الحجري، تصوير عام 1986م','Bernard Gagnon','CC BY-SA 3.0'),
 aden1910:photo('Aden postcard.jpg','ميناء عدن في بطاقة بريدية من نحو عام 1910م','مؤلف غير معروف / ويكيميديا كومنز','ملكية عامة'),
 aden1967:photo('Aden- 1967 (8196340177).jpg','ميناء عدن في صورة تاريخية مرتبطة بعام 1967م','Brian Harrington Spier','CC BY-SA 2.0'),
 aden1967b:photo('Aden- 1967 (8187044461).jpg','سفن عسكرية قرب ميناء عدن في صورة من أرشيف 1967م','Brian Harrington Spier','ترخيص موضح في صفحة الصورة'),
 aden:photo('Aden- 1967 (8196007670).jpg','عدن وميناؤها في صورة من أرشيف حقبة الستينيات','Brian Harrington Spier','CC BY-SA 2.0'),
 coffee:photo('Yemeni Coffee Plant.jpg','نبتة بن يمني في منطقة زراعية مرتفعة، تصوير عام 2026م','Luai Al-Mamari','CC BY-SA'),
 protest:photo('Yemen protest.jpg','احتجاجات صنعاء في 3 فبراير 2011م','Sallam from Yemen','CC BY-SA 2.0'),
 socotra:photo("Dragon's Blood Trees, Socotra Island.jpg",'أشجار دم الأخوين في سقطرى، تصوير حديث','Rod Waddington','CC BY-SA 2.0'),
 mountains:photo('Yemen landscape 01.jpg','منظر جبلي في منطقة كوكبان، تصوير عام 1986م','Bernard Gagnon','ترخيص موضح في صفحة الصورة'),
};
/** Wikimedia Commons FilePath resolves to a public thumbnail. The page link
 * deliberately points to the immutable filename and provides attribution. */
// width: Commons serves the nearest standard thumbnail; small cards ask for less.
export function historyPhotoSource(photo,width=960){
 if(!photo?.file)return '';
 const name=encodeURIComponent(photo.file.replaceAll(' ','_'));
 // commonsFileAt gives an SVG its rendering link, which next/image passes to our optimizer.
 return commonsFileAt('https://commons.wikimedia.org/wiki/Special:FilePath/'+name,width);
}
export function historyPhotoPage(photo){
 if(!photo?.file)return '';
 return 'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(photo.file.replaceAll(' ','_'));
}
const specific={
 'saba':['barran','marib','musnad'],'baran-temple':['barran','awam'],'awam-temple':['awam','barran'],
 'marib-dam':['dam','marib'],'marib-canals':['dam','marib'],
 'ancient-inscriptions':['musnad','barran'],'south-arabian-alphabet':['musnad','awam'],
 'qataban':['musnad','barran'],'timna':['musnad','marib'],
 'hadramawt-kingdom':['shibam','musnad'],'shabwa-capital':['musnad','shibam'],
 'sanaa-before-islam':['sana','sana2'],'islamic-sanaa':['sana','sana2'],
 'great-mosque-sanaa':['sana','sanaOld'],'zabid':['zabid','sana'],
 'zabid-markets':['zabid'],'zabid-scholars':['zabid'],
 'sulayhids':['arwa','arwa2'],'arwa':['arwa','arwa2'],
 'queen-arwa-administration':['arwa','arwa2'],'jibla-capital':['arwa','arwa2'],
 'rasulids':['taiz','zabid'],'rasulid-taiz':['taiz','taiz2'],
 'shibam-city':['shibam','shibam2'],'hadrami-trade':['shibam','shibam2'],
 'shaharah-bridge':['shaharah','mountains'],'aden-british':['aden1910','aden'],
 'aden-1839':['aden1910','aden'],'aden-suez':['aden1910','aden'],
 'aden-port-life':['aden1910','aden'],'independence-1967':['aden1967','aden1967b'],
 'aden-emergency':['aden1967','aden'],'14-october-1963':['aden1967b','aden'],
 'south-1967-republic':['aden1967','aden1967b'],'aden-1967':['aden1967','aden'],
 'qasimi-mocha-trade':['coffee','aden1910'],'coffee-terraces':['coffee','mountains'],
 '2011-protests':['protest','sanaOld'],'women-in-national-dialogue':['protest','sanaOld'],
 'national-dialogue-2013':['protest','sanaOld'],
 'socotra-rock-art':['socotra','mountains'],
 'war-1994':['aden','sanaOld'],
};
const byEra={
 origins:['mountains','socotra'],ancient:['marib','musnad','barran'],islam:['sana','zabid'],
 dynasties:['taiz','arwa','zabid','shibam'],empires:['aden1910','shibam','coffee','shaharah'],
 modern:['sanaOld','aden1967','protest','aden'],
};
const rules=[
 [/socotra|سقطرى/i,['socotra','mountains']],
 [/awam|barran|baran|temple|m[a']?rib|saba|dam|irrigation|سبأ|مأرب|ريّ|السد/i,['barran','marib','dam']],
 [/musnad|inscription|script|epigra|نقوش|مسند|كتابة/i,['musnad','barran']],
 [/qataban|awsan|main-|barqish|timna|himyar|sab[a']|قبطان|حمير|معين/i,['musnad','marib']],
 [/shibam|hadram|shabwa|tari[m]|حضرموت|شبام|تريم/i,['shibam','shibam2']],
 [/coffee|mocha|بنّ|المخا|تجارة البن/i,['coffee','aden1910']],
 [/jibla|arwa|sulayhid|جبلة|أروى|صليحي/i,['arwa','arwa2']],
 [/zabid|ziyad|najahid|رسولي|زبيد/i,['zabid','taiz']],
 [/taiz|tahirid|ayyubid|rasulid|تعز|طاهري|أيوبي/i,['taiz','taiz2']],
 [/kawkaban|haraz|shaharah|قوقبان|حراز|شهارة/i,['mountains','shaharah']],
 [/sana|sanaa|imamate|zaydi|saada|صنعاء|إمامة/i,['sana','sanaOld']],
 [/aden|southern|british|independence|عدن|جنوب|استقلال/i,['aden1967','aden1910']],
 [/2011|2012|2013|2014|dialogue|protest|احتجاج|حوار/i,['protest','sanaOld']],
];
/** Return two best editorially relevant photographs. No historical event is
 * "illustrated" by a modern photo without an explicit contextual label. */
export function getHistoryPhotos(entry){
 if(entry?.hideImages)return [];
 if(Array.isArray(entry?.images)&&entry.images.length)return entry.images;
 if(!entry)return [];
 const text=[entry.slug,entry.title,entry.location||''].join(' ');
 const keys=specific[entry.slug]||
  rules.find(([regex])=>regex.test(text))?.[1]||
  byEra[entry.era]||['sana','marib'];
 const unique=[...new Set(keys)].filter(key=>historyPhotoLibrary[key]);
 return unique.slice(0,2).map((key,index)=>({
  ...historyPhotoLibrary[key],
  kind:'context', // modern photograph never represents an undated historical event
  context:true,
  id:key, // stable keyed credit/reference
 }));
}
