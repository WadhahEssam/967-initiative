// Editorially sourced fields for comparing historical states.
// Time ranges indicate *documented context or influence*, not precise state lifespans.
export const HISTORY_COMPARISON_GROUPS=Object.freeze([
 {id:'overview',title:'نظرة عامة',description:'النشأة ومراكز الحكم والامتداد والمصير',fields:[
  {key:'foundation',label:'النشأة والتأسيس'},
  {key:'capital',label:'العاصمة ومراكز الحكم'},
  {key:'territory',label:'الامتداد الجغرافي'},
  {key:'ending',label:'نهاية الدولة والتحولات'},
 ]},
 {id:'governance',title:'السياسة والحكم',description:'الحكم والقادة والعلاقات والصراعات',fields:[
  {key:'system',label:'النظام السياسي'},
  {key:'rulers',label:'أبرز الحكام'},
  {key:'military',label:'الحروب والقوة العسكرية'},
  {key:'diplomacy',label:'العلاقات الخارجية'},
 ]},
 {id:'economy',title:'الاقتصاد والحياة',description:'الموارد والزراعة والتجارة',fields:[
  {key:'economy',label:'الزراعة والموارد'},
  {key:'trade',label:'التجارة والأنشطة الاقتصادية'},
 ]},
 {id:'civilization',title:'الثقافة والحضارة',description:'المعتقدات والعمارة والشواهد الباقية',fields:[
  {key:'beliefs',label:'الدين والثقافة'},
  {key:'achievements',label:'العمارة والإنجازات'},
  {key:'remains',label:'الآثار والشواهد الباقية'},
 ]},
]);
export const HISTORY_COMPARISON_FIELDS=HISTORY_COMPARISON_GROUPS.flatMap(group=>group.fields);
export const HISTORY_COMPARISON_FIELD_KEYS=new Set(HISTORY_COMPARISON_FIELDS.map(field=>field.key));
const saba='https://whc.unesco.org/en/list/1700/';
const qataban='https://whc.unesco.org/en/tentativelists/6856/';
const himyar='https://whc.unesco.org/en/tentativelists/6846';
const comparison='https://whc.unesco.org/document/191751';
const zabid='https://whc.unesco.org/en/list/611/';
const item=(text,sourceUrl)=>({text,sourceUrl});
export const historyComparisonSeeds={
 saba:{
  timeline:{from:-800,to:300,label:'فترة سيادة وتأثير تقريبي، وليست تاريخ التأسيس والسقوط',sourceUrl:saba},
  facts:{
   foundation:item('شواهد سبئية من الألفية الأولى قبل الميلاد؛ لا يحدد المصدر سنة واحدة مؤكدة للتأسيس.',saba),
   capital:item('مأرب المركز الإداري والاقتصادي والثقافي؛ وصرواح مدينة محصنة ذات دور بارز.',saba),
   territory:item('مراكز في جنوب الجزيرة العربية وشبكات تجارة البخور؛ تغيّر نطاق النفوذ بمرور الزمن.',saba),
   ending:item('تراجعت الهيمنة السبئية مع صعود حمير خلال القرون الميلادية الأولى؛ ولا يدل ذلك على سقوط في سنة واحدة.',saba),
   system:item('تشهد النقوش على إدارة مركزية منظمة ومؤسسات مدنية ودينية في فترات من تاريخ المملكة.',saba),
   military:item('تدل الأسوار والمنشآت المحصنة على جانب دفاعي، ولا يحدد هذا المصدر حجم الجيوش أو عدد المعارك.',saba),
   diplomacy:item('علاقات تبادل عبر القوافل باتجاه شرق أفريقيا وحوض البحر المتوسط ضمن طريق البخور.',saba),
   economy:item('منظومة سد مأرب والقنوات سمحت بزراعة واسعة في بيئة شبه جافة.',saba),
   trade:item('كانت مملكة سبأ من المراكز المؤثرة في تجارة البخور خلال حقب من تاريخ جنوب الجزيرة.',saba),
   beliefs:item('معابد أوام وبرآن وحرونم شواهد على المؤسسات والطقوس الدينية السبئية القديمة.',saba),
   achievements:item('منظومة هندسة المياه ومأرب وصرواح والمعابد والأسوار من أبرز الشواهد المعمارية.',saba),
   remains:item('مواقع مأرب السبعة المدرجة في التراث العالمي، ومنها بقايا المدن والمعابد والمنشآت المائية والنقوش.',saba),
  }
 },
 qataban:{
  facts:{
   foundation:item('ظهرت قرب بداية الألفية الأولى قبل الميلاد، وفق ملف القائمة التمهيدية المقدم من اليمن؛ ولا توجد سنة تأسيس دقيقة.',qataban),
   capital:item('تمنع العاصمة المبكرة، وذات غيلام من آخر مراكز الحكم؛ وكانت حريب مركزًا تجاريًا وإداريًا بارزًا.',qataban),
   territory:item('نشأت في وادي بيحان في شبوة المعاصرة، واتصل نفوذها في مراحل مختلفة بأودية ومناطق أبعد.',qataban),
   system:item('مملكة ذات مراكز حضرية وإدارية وتجارية ودينية متعددة، توضحها آثار مدن وادي بيحان.',qataban),
   military:item('توجد شواهد على أسوار وبوابات وتحصينات دفاعية، دون تقديرات موثقة في هذا المصدر لحجم الجيش.',qataban),
   diplomacy:item('ارتبطت مدنها بشبكة قوافل وطرق تربط تمنع وحريب والمراكز المحيطة.',qataban),
   economy:item('مراكز زراعية مرتبطة بالوديان وقنوات الري والسدود، إلى جانب التخزين والتبادل التجاري.',qataban),
   trade:item('توجد في تمنع مسلة لقانون تجاري منقوش بالمسند، ترتبط بتنظيم التجارة الداخلية والخارجية.',qataban),
   beliefs:item('تظهر في المواقع المعابد والعمارة الدينية، مع اختلاف وظائف المدن ومراحل عمرانها.',qataban),
   achievements:item('التخطيط الحضري والأسوار والبوابات والطرق المرصوفة والأسواق من أبرز الشواهد.',qataban),
   remains:item('آثار تمنع وحريب وذات غيلام، ونقش القانون التجاري؛ وترد المعلومات في ملف يمني على قائمة اليونسكو التمهيدية، لا في موقع مدرج.',qataban),
  }
 },
 himyar:{
  timeline:{from:-110,to:525,label:'الفترة المذكورة لظفار عاصمةً حميرية في دراسة ترشيح سبأ؛ ليست مدة الدولة كاملة',sourceUrl:comparison},
  facts:{
   foundation:item('تكوّن النفوذ الحميري عبر مراحل في أواخر تاريخ ممالك الجنوب؛ لا يثبت هذا المرجع تاريخ تأسيس واحدًا.',himyar),
   capital:item('ظفار في المرتفعات اليمنية، وتوجد شواهد أثرية مرتبطة بقصر ريدان ومعبده.',himyar),
   territory:item('ارتبطت بالمرتفعات اليمنية ثم اتسع النفوذ في عصور مختلفة؛ لا تظهر هنا حدود سياسية ثابتة.',himyar),
   system:item('مملكة جنوب عربية ذات سلطة ملكية شهدت فترات توحيد لمراكز نفوذ متعددة.',himyar),
   diplomacy:item('ارتبطت مراكزها بالطرق التجارية البرية والبحرية في جنوب الجزيرة.',himyar),
   economy:item('استُخدمت السدود والحواجز وخزانات المياه المنحوتة في الصخور لتأمين الزراعة.',himyar),
   trade:item('أشارت وثيقة القائمة التمهيدية اليمنية إلى دور المنطقة في التجارة البرية والبحرية.',himyar),
   beliefs:item('تظهر بقايا معابد في ظفار؛ وتوثق دراسات الموقع تحولات دينية متعددة عبر أواخر العصور القديمة.',comparison),
   achievements:item('تميزت ظفار بمنظومات حصاد مياه الأمطار والسدود والخزانات الصخرية والمدرجات.',himyar),
   remains:item('آثار ظفار ومعبد ريدان والقنوات والمدافن والنقوش، وفق مواد الترشيح والدراسة الأثرية.',himyar),
  }
 },
 main:{
  facts:{
   capital:item('برقش ثم قرناو (معين)، بحسب المقارنة الأثرية الواردة في دراسة ترشيح معالم سبأ.',comparison),
   territory:item('تظهر معالمها في الجوف ومراكز القوافل ضمن جنوب الجزيرة القديم؛ لا يحدد المرجع حدودها في كل عصر.',comparison),
   economy:item('ارتبطت مدنها بالحركة التجارية والواحات، مع آثار لمراكز دينية وحضرية.',comparison),
   remains:item('تتناول الدراسة الأثرية مدينة قرناو ومعابدها ونقوشها ومخططها العمراني.',comparison),
  }
 },
 rasulids:{
  facts:{
   capital:item('تذكر اليونسكو أن زبيد كانت عاصمة لليمن بين القرنين الثالث عشر والخامس عشر، وتوثق فيها مدارس من العصر الرسولي.',zabid),
   achievements:item('تشهد مدارس زبيد ومساجدها والعمارة السكنية على ازدهار عمراني وتعليمي، ومنها أربع عشرة مدرسة تعود إلى العصر الرسولي.',zabid),
   remains:item('مبانٍ ومدارس ومساجد تاريخية في زبيد، وبعضها مرتبط مباشرة بالفترة الرسولية.',zabid),
   beliefs:item('كانت زبيد مركزًا للتعليم الإسلامي ومؤسساته خلال مراحل من تاريخها.',zabid),
  }
 }
};

export function comparisonFact(entry,key){
 const fact=entry?.comparison?.facts?.[key];
 return fact&&typeof fact.text==='string'&&fact.text.trim()&&typeof fact.sourceUrl==='string'
   &&entry?.sources?.some(source=>source.url===fact.sourceUrl) ? fact : null;
}
export function comparisonPeriod(entry){
 const timeline=entry?.comparison?.timeline;
 if(!timeline||!Number.isInteger(timeline.from)||!Number.isInteger(timeline.to)||
  timeline.from>=timeline.to||!entry?.sources?.some(s=>s.url===timeline.sourceUrl))return null;
 return timeline;
}
export function historyComparisonOverlap(a,b){
 const first=comparisonPeriod(a),second=comparisonPeriod(b);
 if(!first||!second)return null;
 return Math.max(first.from,second.from)<=Math.min(first.to,second.to);
}
export function comparisonCoverage(entry){
 return HISTORY_COMPARISON_FIELDS.filter(field=>comparisonFact(entry,field.key)).length;
}
export const historyPairNotes={
 'qataban|saba':{
  common:'ترتبط المملكتان بتاريخ جنوب الجزيرة القديم وبالتجارة والزراعة؛ وتذكر وثيقة قتبان أنهما كانتا متعاصرتين في مراحل من التاريخ.',
  difference:'تركز شواهد سبأ على مأرب ومنظومة ري واسعة، بينما تبرز مدن قتبان وأسواقها في وادي بيحان.',
  sources:[saba,qataban],
 },
 'himyar|saba':{
  common:'امتدت شواهد المملكتين عبر جنوب الجزيرة، وتُظهر الآثار أهمية المدن المحصنة والري.',
  difference:'يرتبط سجل سبأ بمأرب، بينما ترتبط حمير بظفار في المرتفعات؛ كما تصف المراجع صعود حمير وتراجع النفوذ السبئي.',
  sources:[saba,himyar],
 }
};
// The pair shown before the reader picks one: Saba and Qataban, or the first two states.
export function defaultHistoryPair(entries){
 const first=entries.find(row=>row.slug==='saba')?.slug||entries[0]?.slug||'';
 const second=entries.find(row=>row.slug==='qataban'&&row.slug!==first)?.slug||entries.find(row=>row.slug!==first)?.slug||'';
 return [first,second];
}
export function comparisonPairNote(a,b){
 if(!a||!b)return null;
 return historyPairNotes[[a.slug,b.slug].sort().join('|')]||null;
}
