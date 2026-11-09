// «سوق 967» catalogue: categories, subcategories and their fields, from the owner's spec
// (مواصفات سوق 967 — المرحلة الأولى). Values are short ASCII keys; labels are Arabic.
// Field types: select (options), brand (list + «أخرى» free text), model (depends on brand),
// number (min/max/unit), text (short free text). `required` fields are asked before publishing.

export const CURRENCIES=[
 {value:'YER_OLD',label:'ريال يمني (صنعاء)',short:'ر.ي'},
 {value:'YER_NEW',label:'ريال يمني (عدن)',short:'ر.ي (عدن)'},
 {value:'USD',label:'دولار أمريكي',short:'$'},
 {value:'SAR',label:'ريال سعودي',short:'ر.س'},
 {value:'EUR',label:'يورو',short:'€'},
];
export const CONDITIONS=[
 {value:'new',label:'جديد'},
 {value:'like_new',label:'مستعمل بحالة ممتازة'},
 {value:'used',label:'مستعمل'},
 {value:'needs_repair',label:'يحتاج إصلاح'},
];
export const OTHER='other';

const opts=pairs=>pairs.map(([value,label])=>({value,label}));
const select=(key,label,pairs,extra={})=>({key,label,type:'select',options:opts(pairs),...extra});
const number=(key,label,extra={})=>({key,label,type:'number',min:0,...extra});
const text=(key,label,extra={})=>({key,label,type:'text',maxLength:80,...extra});
const brand=(key,label,list,extra={})=>({key,label,type:'brand',brands:list,...extra});
const yesNo=(key,label,extra={})=>select(key,label,[['yes','نعم'],['no','لا']],extra);
const thisYear=new Date().getUTCFullYear();
const year=(extra={})=>number('year','سنة الصنع',{min:1960,max:thisYear+1,step:1,...extra});

// Brands, roughly by how common they are in Yemen; «أخرى» lets the seller type any other name.
export const CAR_BRANDS=opts([['toyota','تويوتا'],['hyundai','هيونداي'],['kia','كيا'],['nissan','نيسان'],['mitsubishi','ميتسوبيشي'],['honda','هوندا'],['lexus','لكزس'],['chevrolet','شيفروليه'],['gmc','جي إم سي'],['ford','فورد'],['mazda','مازدا'],['suzuki','سوزوكي'],['isuzu','إيسوزو'],['geely','جيلي'],['changan','شانجان'],['mg','إم جي']]);
export const CAR_MODELS={
 toyota:opts([['hilux','هايلكس'],['land_cruiser','لاندكروزر'],['prado','برادو'],['corolla','كورولا'],['camry','كامري'],['hiace','هايس'],['fortuner','فورتشنر'],['yaris','يارس']]),
 hyundai:opts([['elantra','النترا'],['sonata','سوناتا'],['accent','أكسنت'],['tucson','توسان'],['santa_fe','سنتافي'],['h1','H1']]),
 kia:opts([['sportage','سبورتاج'],['cerato','سيراتو'],['optima','أوبتيما / K5'],['sorento','سورنتو'],['rio','ريو']]),
 nissan:opts([['patrol','باترول'],['sunny','صني'],['altima','التيما'],['navara','نافارا'],['pathfinder','باثفايندر']]),
 mitsubishi:opts([['l200','L200'],['pajero','باجيرو'],['lancer','لانسر'],['outlander','أوتلاندر'],['asx','ASX']]),
 honda:opts([['accord','أكورد'],['civic','سيفيك'],['crv','CR-V'],['pilot','بايلوت'],['odyssey','أوديسي']]),
 lexus:opts([['lx','LX'],['gx','GX'],['rx','RX'],['es','ES'],['is','IS']]),
 chevrolet:opts([['tahoe','تاهو'],['silverado','سيلفرادو'],['malibu','ماليبو'],['captiva','كابتيفا'],['cruze','كروز']]),
 gmc:opts([['yukon','يوكن'],['sierra','سييرا'],['acadia','أكاديا'],['savana','سافانا']]),
 ford:opts([['f150','F-150'],['explorer','إكسبلورر'],['ranger','رينجر'],['expedition','إكسبديشن'],['taurus','توروس']]),
 mazda:opts([['mazda3','مازدا 3'],['mazda6','مازدا 6'],['cx5','CX-5'],['bt50','BT-50']]),
 suzuki:opts([['swift','سويفت'],['vitara','فيتارا'],['jimny','جيمني'],['dzire','ديزاير']]),
 isuzu:opts([['dmax','D-Max'],['npr','NPR'],['nkr','NKR'],['mux','MU-X']]),
 geely:opts([['coolray','كولراي'],['emgrand','إمجراند'],['okavango','أوكافانجو'],['monjaro','مونجارو']]),
 changan:opts([['cs35','CS35'],['cs75','CS75'],['alsvin','ألسفن'],['eado','إيدو']]),
 mg:opts([['mg5','MG5'],['zs','ZS'],['rx5','RX5'],['hs','HS']]),
};
export const MOTORCYCLE_BRANDS=opts([['honda','هوندا'],['yamaha','ياماها'],['suzuki','سوزوكي'],['bajaj','باجاج'],['tvs','تي في إس'],['chinese','ماركات صينية']]);
export const PHONE_BRANDS=opts([['samsung','سامسونج'],['apple','آبل'],['xiaomi','شاومي (ريدمي / بوكو)'],['tecno','تكنو'],['infinix','إنفينكس'],['huawei','هواوي'],['honor','هونر'],['oppo','أوبو'],['realme','ريلمي'],['vivo','فيفو'],['itel','آيتل'],['nokia','نوكيا']]);
export const COMPUTER_BRANDS=opts([['hp','إتش بي'],['dell','ديل'],['lenovo','لينوفو'],['apple','آبل'],['asus','أسوس'],['acer','أيسر'],['samsung','سامسونج'],['microsoft','مايكروسوفت']]);
export const PANEL_BRANDS=opts([['jinko','جينكو'],['longi','لونجي'],['ja_solar','جيه إيه سولار'],['trina','ترينا'],['canadian_solar','كنديان سولار']]);
export const INVERTER_BRANDS=opts([['growatt','جرووات'],['deye','داي'],['must','ماست'],['felicity','فيليسيتي'],['axpert','أكسبرت'],['victron','فيكترون'],['huawei','هواوي']]);

const area=(required=false)=>[number('area','المساحة',{required,max:10_000_000}),select('area_unit','وحدة المساحة',[['m2','م²'],['libna','لبنة']],{required})];
const deed=select('deed','نوع الوثيقة',[['basira','بصيرة'],['sak','صك'],['registered_contract','عقد مسجل'],['other','أخرى']]);
const furnished=yesNo('furnished','مفروش');

export const CATEGORIES=[
 {key:'vehicles',label:'مركبات',icon:'car',subcategories:[
  {key:'cars',label:'سيارات',titleFrom:['brand','model','year'],highlights:['year','mileage_km','transmission','fuel'],fields:[
   select('body','نوع الهيكل',[['sedan','صالون'],['suv','دفع رباعي'],['pickup','بيك أب'],['bus','باص']],{required:true}),
   brand('brand','الماركة',CAR_BRANDS,{required:true}),
   {key:'model',label:'الموديل',type:'model',dependsOn:'brand',models:CAR_MODELS,required:true},
   year({required:true}),
   number('mileage_km','الممشى',{required:true,max:3_000_000,unit:'كم'}),
   select('transmission','القير',[['manual','عادي'],['automatic','أوتوماتيك']]),
   select('fuel','الوقود',[['petrol','بترول'],['diesel','ديزل'],['hybrid','هايبرد'],['gas','غاز']]),
   select('drive','الدفع',[['2wd','ثنائي'],['4wd','رباعي']]),
   select('origin','الوارد',[['gcc','خليجي'],['american','أمريكي'],['korean','كوري'],['japanese','ياباني'],['other','أخرى']]),
   text('color','اللون',{maxLength:30}),
   yesNo('accident','تعرضت لحادث'),
  ]},
  {key:'motorcycles',label:'دراجات نارية',titleFrom:['brand','year'],highlights:['year','engine_cc'],fields:[
   brand('brand','الماركة',MOTORCYCLE_BRANDS,{required:true}),year(),number('engine_cc','سعة المحرك',{max:5000,unit:'سي سي'}),
  ]},
  {key:'trucks',label:'شاحنات ومعدات ثقيلة',titleFrom:['type','brand','year'],highlights:['year','payload_ton'],fields:[
   select('type','النوع',[['truck','شاحنة'],['dump','قلاب'],['crane','رافعة'],['tractor','حراثة']],{required:true}),
   text('brand','الماركة',{required:true,maxLength:40}),year(),number('payload_ton','الحمولة',{max:500,unit:'طن'}),
  ]},
  {key:'parts',label:'قطع غيار وإكسسوارات',titleFrom:['part_type','compatible_brand','compatible_model'],highlights:['part_origin'],fields:[
   select('part_type','نوع القطعة',[['engine','محرك'],['gearbox','قير'],['body','بودي'],['tires','إطارات'],['lights','إضاءة'],['accessories','إكسسوارات']],{required:true}),
   brand('compatible_brand','الماركة المتوافقة',CAR_BRANDS,{required:true}),
   text('compatible_model','الموديل المتوافق',{maxLength:40}),
   select('part_origin','أصلي / تجاري',[['original','أصلي'],['aftermarket','تجاري']]),
  ]},
 ]},
 {key:'real_estate',label:'عقارات',icon:'home',subcategories:[
  {key:'for_sale',label:'للبيع',titleFrom:['property_type','rooms'],highlights:['rooms','area','floor'],fields:[
   select('property_type','النوع',[['apartment','شقة'],['house','بيت'],['villa','فيلا'],['building','عمارة'],['shop','محل'],['office','مكتب']],{required:true}),
   number('rooms','عدد الغرف',{required:true,max:100}),number('bathrooms','عدد الحمامات',{max:50}),number('floor','الدور',{max:100}),number('floors','عدد الأدوار',{max:100}),
   ...area(true),number('building_age','عمر البناء',{max:300,unit:'سنة'}),furnished,deed,
  ]},
  {key:'for_rent',label:'للإيجار',titleFrom:['property_type','rooms'],highlights:['rooms','payment_period','furnished'],fields:[
   select('property_type','النوع',[['apartment','شقة'],['house','بيت'],['shop','محل'],['office','مكتب'],['warehouse','مستودع']],{required:true}),
   number('rooms','عدد الغرف',{required:true,max:100}),number('floor','الدور',{max:100}),...area(),furnished,
   select('payment_period','مدة الدفع',[['monthly','شهري'],['yearly','سنوي']],{required:true}),number('advance_months','عدد الأشهر المقدمة',{max:36}),
  ]},
  {key:'land',label:'أراضٍ',titleFrom:['land_type','area'],highlights:['area','street_width_m'],fields:[
   select('land_type','النوع',[['residential','سكنية'],['commercial','تجارية'],['agricultural','زراعية']],{required:true}),
   ...area(true),number('street_width_m','تطل على شارع بعرض',{max:200,unit:'متر'}),deed,
  ]},
 ]},
 {key:'electronics',label:'إلكترونيات',icon:'phone',subcategories:[
  {key:'phones',label:'جوالات وتابلت',titleFrom:['brand','model','storage'],highlights:['storage','ram','battery_health'],fields:[
   brand('brand','الماركة',PHONE_BRANDS,{required:true}),text('model','الموديل',{required:true,maxLength:40}),
   select('storage','سعة التخزين',[['16','16 جيجا'],['32','32 جيجا'],['64','64 جيجا'],['128','128 جيجا'],['256','256 جيجا'],['512','512 جيجا'],['1024','1 تيرا']],{required:true}),
   select('ram','الرام',[['2','2 جيجا'],['3','3 جيجا'],['4','4 جيجا'],['6','6 جيجا'],['8','8 جيجا'],['12','12 جيجا'],['16','16 جيجا']]),
   number('battery_health','صحة البطارية',{max:100,unit:'%'}),yesNo('dual_sim','شريحتان'),text('color','اللون',{maxLength:30}),
  ]},
  {key:'computers',label:'كمبيوتر ولابتوب',titleFrom:['type','brand'],highlights:['cpu','ram','storage'],fields:[
   select('type','النوع',[['laptop','لابتوب'],['desktop','مكتبي'],['monitor','شاشة'],['printer','طابعة'],['accessories','ملحقات']],{required:true}),
   brand('brand','الماركة',COMPUTER_BRANDS,{required:true}),text('cpu','المعالج',{maxLength:60}),text('ram','الرام',{maxLength:20}),
   text('storage','التخزين',{maxLength:30}),select('storage_type','نوع التخزين',[['ssd','SSD'],['hdd','HDD']]),text('gpu','كرت الشاشة',{maxLength:60}),number('screen_inch','حجم الشاشة',{max:120,unit:'بوصة'}),
  ]},
  {key:'tv_audio',label:'تلفزيونات وصوتيات وكاميرات',titleFrom:['type','brand'],highlights:['screen_inch'],fields:[
   select('type','النوع',[['tv','تلفزيون'],['audio','صوتيات'],['camera','كاميرا'],['other','أخرى']],{required:true}),text('brand','الماركة',{maxLength:40}),number('screen_inch','حجم الشاشة (للتلفزيونات)',{max:120,unit:'بوصة'}),
  ]},
  {key:'gaming',label:'أجهزة ألعاب',titleFrom:['type','edition'],highlights:['edition'],fields:[
   select('type','النوع',[['playstation','بلايستيشن'],['xbox','إكس بوكس'],['nintendo','نينتندو'],['games','ألعاب وملحقات']],{required:true}),text('edition','الإصدار',{maxLength:40}),
  ]},
 ]},
 {key:'solar',label:'طاقة شمسية وكهرباء',icon:'sun',subcategories:[
  {key:'panels',label:'ألواح',titleFrom:['brand','watt'],highlights:['watt','count'],fields:[
   number('watt','القدرة',{required:true,max:2000,unit:'واط'}),number('count','العدد',{max:10000}),brand('brand','الماركة',PANEL_BRANDS),
  ]},
  {key:'batteries',label:'بطاريات',titleFrom:['battery_type','capacity_ah'],highlights:['capacity_ah','voltage'],fields:[
   select('battery_type','النوع',[['gel','جل'],['lithium','ليثيوم'],['acid','أسيد']],{required:true}),number('capacity_ah','السعة',{required:true,max:10000,unit:'أمبير'}),
   select('voltage','الجهد',[['12','12 فولت'],['24','24 فولت'],['48','48 فولت']]),text('brand','الماركة',{maxLength:40}),
  ]},
  {key:'inverters',label:'انفرترات ومنظمات',titleFrom:['brand','kw'],highlights:['kw','voltage'],fields:[
   number('kw','القدرة',{required:true,max:1000,unit:'كيلوواط'}),select('voltage','الجهد',[['12','12 فولت'],['24','24 فولت'],['48','48 فولت']]),brand('brand','الماركة',INVERTER_BRANDS),
  ]},
  {key:'generators',label:'مولدات',titleFrom:['kva'],highlights:['kva','fuel'],fields:[
   number('kva','القدرة',{required:true,max:5000,unit:'كيلو فولت أمبير'}),select('fuel','الوقود',[['petrol','بترول'],['diesel','ديزل'],['gas','غاز']]),
  ]},
 ]},
 {key:'home',label:'المنزل والأسرة',icon:'sofa',subcategories:[
  {key:'appliances',label:'أجهزة منزلية',titleFrom:['type','brand'],highlights:['capacity'],fields:[
   select('type','النوع',[['fridge','ثلاجة'],['washer','غسالة'],['ac','مكيف'],['oven','فرن وبوتاجاز'],['heater','سخان'],['water_filter','فلتر مياه']],{required:true}),
   text('brand','الماركة',{maxLength:40}),text('capacity','السعة (لتر / كغ / طن تبريد)',{maxLength:30}),
  ]},
  {key:'furniture',label:'أثاث ومفروشات',titleFrom:['type'],highlights:['material','pieces'],fields:[
   select('type','النوع',[['bedroom','غرفة نوم'],['majlis','مجلس عربي'],['sofa','كنب'],['dining','سفرة'],['office','مكتب'],['carpets','فرش وسجاد']],{required:true}),
   text('material','الخامة',{maxLength:40}),number('pieces','عدد القطع',{max:500}),
  ]},
  {key:'kids',label:'مستلزمات أطفال',titleFrom:['type'],highlights:['age_range'],fields:[
   select('type','النوع',[['strollers','عربات'],['car_seats','كراسي سيارة'],['toys','ألعاب'],['clothes','ملابس']],{required:true}),text('age_range','العمر المناسب',{maxLength:30}),
  ]},
 ]},
 {key:'fashion',label:'أزياء وإكسسوارات',icon:'shirt',subcategories:[
  {key:'men',label:'رجالي',titleFrom:['type'],highlights:['size'],fields:[
   select('type','النوع',[['thobes','ثياب'],['maawiz','معاوز'],['shawls','شيلان'],['coats','كوتات'],['shoes','أحذية']],{required:true}),text('size','المقاس',{maxLength:20}),
  ]},
  {key:'women',label:'نسائي',titleFrom:['type'],highlights:['size'],fields:[
   select('type','النوع',[['abayas','عبايات'],['dresses','فساتين'],['shoes','أحذية'],['bags','شنط']],{required:true}),text('size','المقاس',{maxLength:20}),
  ]},
  {key:'watches_jewelry',label:'ساعات ومجوهرات وعطور',titleFrom:['type','material'],highlights:['material','weight_g'],fields:[
   select('type','النوع',[['watches','ساعات'],['rings','خواتم وعقيق'],['silver','فضة'],['gold','ذهب'],['perfume','عطور وبخور']],{required:true}),
   text('material','الخامة',{maxLength:40}),number('weight_g','الوزن (للذهب والفضة)',{max:100000,unit:'جرام'}),
  ]},
 ]},
 {key:'animals',label:'حيوانات',icon:'paw',subcategories:[
  {key:'livestock',label:'مواشي ودواجن',titleFrom:['type','breed','count'],highlights:['count','age','sex'],fields:[
   select('type','النوع',[['sheep','أغنام'],['goats','ماعز'],['cows','أبقار'],['camels','إبل'],['poultry','دواجن']],{required:true}),
   text('breed','السلالة',{maxLength:40}),text('age','العمر',{maxLength:30}),select('sex','الجنس',[['male','ذكر'],['female','أنثى'],['mixed','مختلط']]),number('count','العدد',{required:true,min:1,max:100000}),
  ]},
  {key:'pets',label:'حيوانات أليفة ومستلزماتها',titleFrom:['type'],highlights:['age'],fields:[
   select('type','النوع',[['cats','قطط'],['birds','طيور'],['fish','أسماك'],['supplies','مستلزمات']],{required:true}),text('age','العمر',{maxLength:30}),
  ]},
 ]},
 {key:'equipment',label:'معدات وأعمال',icon:'tools',subcategories:[
  {key:'agriculture',label:'زراعة وري',titleFrom:['type'],highlights:['pump_kind','horsepower'],fields:[
   select('type','النوع',[['seeds','بذور وشتلات'],['pumps','مضخات مياه'],['irrigation','منظومات ري'],['machinery','معدات زراعية']],{required:true}),
   select('pump_kind','نوع المضخة',[['submersible','غاطسة'],['surface','سطحية']]),number('horsepower','القدرة',{max:5000,unit:'حصان'}),
  ]},
  {key:'building',label:'مواد بناء وعدد',titleFrom:['type'],highlights:['quantity'],fields:[
   select('type','النوع',[['steel','حديد'],['cement','أسمنت'],['blocks','بلك وأحجار'],['power_tools','أدوات كهربائية'],['hand_tools','عدد يدوية']],{required:true}),
   number('quantity','الكمية',{max:10_000_000}),text('unit','الوحدة',{maxLength:20}),
  ]},
  {key:'commercial',label:'معدات تجارية ومطاعم',titleFrom:['type','brand'],highlights:['brand'],fields:[
   select('type','النوع',[['display_fridges','ثلاجات عرض'],['ovens','أفران'],['restaurant','معدات مطاعم'],['shop_fittings','تجهيزات محلات']],{required:true}),text('brand','الماركة',{maxLength:40}),
  ]},
 ]},
 {key:'hobbies',label:'رياضة وهوايات وكتب',icon:'ball',subcategories:[
  {key:'sports',label:'أدوات رياضية',titleFrom:['type'],highlights:[],fields:[text('type','النوع',{required:true,maxLength:60})]},
  {key:'bicycles',label:'دراجات هوائية',titleFrom:['type'],highlights:[],fields:[text('type','النوع',{required:true,maxLength:60})]},
  {key:'books',label:'كتب ومناهج',titleFrom:['type'],highlights:[],fields:[text('type','النوع',{required:true,maxLength:60})]},
  {key:'hobbies',label:'هوايات',titleFrom:['type'],highlights:[],fields:[text('type','النوع',{required:true,maxLength:60})]},
 ]},
 {key:'other',label:'أخرى',icon:'box',subcategories:[
  {key:'other',label:'كل ما لا يدخل في الفئات السابقة',titleFrom:[],highlights:[],fields:[]},
 ]},
];

export function findCategory(key){return CATEGORIES.find(item=>item.key===key)||null;}
export function findSubcategory(categoryKey,subKey){return findCategory(categoryKey)?.subcategories.find(item=>item.key===subKey)||null;}
export const currencyLabel=value=>CURRENCIES.find(item=>item.value===value)?.label||'';
export const conditionLabel=value=>CONDITIONS.find(item=>item.value===value)?.label||'';
