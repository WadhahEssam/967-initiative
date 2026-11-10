// Public navigation and home sections, with the same destinations shown on the site.
import {contentPagesForSearch,createDefaultContentPages} from './contentPages.js';
export const searchPages = [
  {title:'مناظرات 967',description:'في الاختلاف رحمة. مساحة يمنية للحوار المنظم والأسئلة والاستطلاعات ومشاهدة التسجيلات.',href:'/debates',keywords:'مناظرة حوار نقاش مشاركون مباشر مسجل أسئلة تصويت'},
  {title:'ترتيب اليمن',description:'اكتشف ترتيب اليمن عالمياً وعربياً في الاقتصاد والصحة والتعليم والتقنية والخدمات والعمل، وقارن الدول والسنة ومصادر البيانات.',href:'/yemen-ranking',keywords:'ترتيب تصنيف مقارنة دول العالم دخل ناتج محلي سكان تعليم صحة إنترنت'},
  {title:'مبادرة 967',description:'مساحة يمنية للمعرفة والإعلام والثقافة والبيانات والمشاركة المجتمعية.',href:'/',keywords:'الرئيسية المنصة اليمن'},
  {title:'الأعمال الإعلامية',description:'الفيديوهات والحوارات والتغطيات من مبادرة 967.',href:'/works',keywords:'أعمالنا المكتبة الإعلامية'},
  {title:'مجلة 967',description:'قراءة المجلة وتحميل ملفات PDF وتصفح أرشيف الأعداد.',href:'/magazine',keywords:'مجلة أعداد أرشيف'},
  {title:'اليمن بالأرقام',description:'المؤشرات الوطنية ومصادرها وسنوات قياسها ومنهجيتها.',href:'/yemen-in-numbers',keywords:'الإحصاءات البيانات المرصد'},
  {title:'اليمن عبر الزمن',description:'مقارنة السلاسل الزمنية والقيم ونسب التغير وتنزيل البيانات.',href:'/yemen-in-numbers/timeline',keywords:'مقارنة رسوم بيانية CSV'},
  {title:'خريطة اليمن',description:'الأطلس التفاعلي لمحافظات اليمن ومديرياته وأماكنه.',href:'/yemen-map',keywords:'جغرافيا خريطة محافظات مديريات أماكن'},
  {title:'أسعار الصرف اليوم',description:'سعر الدولار والريال السعودي في صنعاء وعدن يوميًا، مع حاسبة للصرف والحوالات.',href:'/services/exchange-rates',keywords:'سعر الصرف الدولار الريال السعودي صرافة حوالة تحويل عدن صنعاء عملة'},
  {title:'أسعار المواد الأساسية',description:'أسعار الدقيق والأرز والسكر والزيت والخضار واللحوم والغاز والوقود في صنعاء وعدن أسبوعيًا.',href:'/services/food-prices',keywords:'اسعار المواد الغذائية دقيق رز ارز سكر زيت بيض دجاج لحم طماطم بطاطس بصل غاز بترول ديزل وايت ماء السوق الغلاء صنعاء عدن'},
  {title:'دليل المعاملات',description:'خطوات وأوراق ورسوم أشهر المعاملات الحكومية في صنعاء وعدن.',href:'/transactions',keywords:'معاملة معاملات جواز سفر بطاقة شخصية هوية شهادة ميلاد رخصة قيادة توثيق شهادات صحيفة سوابق حسن سيرة اوراق مطلوبة رسوم'},
  {title:'مدرسة 967',description:'تعلّم مهارات عبر مراحل تفاعلية، مع إعادة المحاولة وحفظ التقدم.',href:'/school',keywords:'مدرسة تعلم تعليم دروس خط المسند مهارات'},
  {title:'الكتابة والأدب | مدرسة 967',description:'مسارات تعلم الكتابة والأدب، بدءًا بخط المسند.',href:'/school/writing',keywords:'كتابة أدب مسند عروض خطوط عربية'},
  {title:'دليل أبجدية المسند',description:'تعرّف على حروف المسند الـ29 مع أصواتها ونقلها اللاتيني.',href:'/school/writing/musnad/alphabet',keywords:'مسند أبجدية حروف 29 أسماء'},
  {title:'لوحة كتابة المسند',description:'تدرب على رسم الحروف والتتبّع باليد أو الفأرة.',href:'/school/writing/musnad/practice',keywords:'مسند كتابة خط تمرين تتبع رسم'},
  {title:'علم العروض | مدرسة 967',description:'تعلم التقطيع العروضي والمقاطع والتفعيلات في أربع مراحل تفاعلية.',href:'/school/courses/arud',keywords:'عروض شعر وزن بحور تقطيع تفعيلات مدرسة'},
  {title:'محطات التعلّم العروضي',description:'دروس في النطق والحركة والسكون والمقاطع وإيقاع التفعيلات.',href:'/school/courses/arud/1',keywords:'دروس عروض متحرك ساكن مقاطع تفعيلة'},
  {title:'تعلم خط المسند',description:'خط المسند: حروف قديمة وتعرف الرموز وتركيب تسلسلات الحروف.',href:'/school/courses/musnad',keywords:'مسند سبئي جنوب الجزيرة العربية نقش مدرسة تعلم حروف'},
  {title:'ألعاب 967',description:'ألعاب ثقافية تفاعلية عن اليمن، اختبر معلوماتك في التاريخ والجغرافيا والتراث وتحدَّ نفسك كل يوم.',href:'/games',keywords:'مسابقة لعبة ألعاب تحدي يومي ترفيه تعليم ثقافة يمني'},
  {title:'اختبر معرفتك باليمن',description:'10 أسئلة عن اليمن، مع النقاط والإجابات المشروحة والمصادر.',href:'/games/quiz',keywords:'اختبار ثقافة عامة تاريخ جغرافيا أسئلة'},
  {title:'خمن المكان',description:'لعبة صور لمعالم ومدن يمنية، تخمين المكان ومؤقت وتحدي يومي.',href:'/games/place',keywords:'صور خمن مكان محافظة مدينة'},
  {title:'رتب التاريخ',description:'رتب الأحداث التاريخية في اليمن من الأقدم إلى الأحدث ضمن تحدٍ زمني.',href:'/games/timeline',keywords:'ترتيب تاريخ سنوات أحداث ممالك'},
  {title:'أين تقع؟',description:'لعبة اختيار محافظة اليمن الصحيحة على خريطة تفاعلية.',href:'/games/map',keywords:'لعبة خريطة محافظات جغرافيا'},
  {title:'من أنا؟',description:'تلميحات لاكتشاف شخصيات يمنية مشهورة.',href:'/games/who',keywords:'من أنا شخصيات يمنية لعبة'},
  {title:'أيهما أكبر؟',description:'مقارنات المساحات والارتفاعات اليمنية.',href:'/games/bigger',keywords:'أيهما أكبر مساحات مرتفعات مقارنة'},
  {title:'اربط المعلومة',description:'وصّل الشخصيات والأحداث بالمعلومات.',href:'/games/connect',keywords:'ربط المعلومات توصيل تاريخ اليمن'},
  {title:'خمن الإجابة اليمنية',description:'كوّن الإجابة من حروف عن اليمن.',href:'/games/yemenword',keywords:'أحرف تخمين كلمات شخصية حدث'},
  {title:'ما هذا الشيء؟',description:'صور موثقة من تراث اليمن.',href:'/games/object',keywords:'صور آثار أدوات تراث يمني'},
  {title:'لوحة المتصدرين',description:'الترتيب اليومي والأسبوعي والشهري والتاريخي في ألعاب 967 بنقاط رسمية.',href:'/games/leaderboard',keywords:'ترتيب متصدرون منافسة تحدي 967 leaderboard'},
  {title:'إنجازات ألعاب 967',description:'شارات دائمة تحصّلها من تحدي اليوم: المشاركة، الإتقان، والاستمرارية.',href:'/games/achievements',keywords:'إنجازات شارات أوسمة ألعاب جوائز 967'},
  {title:'تاريخ اليمن',description:'خط زمني وموسوعة للممالك والدول والأحداث والآثار والمجتمع اليمني مع المصادر.',href:'/yemen-history',keywords:'تاريخ ممالك سبأ حمير معين قتبان دولة رسولية صليحية وثائق نقوش'},
  {title:'شخصيات يمنية',description:'دليل مستقل للسير اليمنية التاريخية والمعاصرة، مع البحث بالمجال والفترة والمحافظة.',href:'/yemeni-figures',keywords:'شخصيات سير تاريخ أعلام أدباء علماء قادة فنانون'},
  {title:'منتجات يمنية',description:'دليل الشركات والمنتجات المحلية والقطاعات.',href:'/yemeni-products',keywords:'دليل شركات منتجات صناعة'},
  {title:'المهنيون',description:'دليل أصحاب المهارات والمهن والخدمات.',href:'/professionals',keywords:'حرف خدمات مهن تخصصات'},
  {title:'دليل الجامعات والمعاهد',description:'دليل المؤسسات التعليمية اليمنية الموثقة مع البحث حسب المحافظة والنوع.',href:'/universities',keywords:'جامعات معاهد كليات تعليم عال قبول تخصصات'},
  {title:'دليل المراكز الطبية',description:'دليل المنشآت الصحية اليمنية الموثقة ومعلومات مواقعها وحالة بياناتها.',href:'/medical-centers',keywords:'مستشفيات مراكز صحية طبية عيادات خدمات تخصصات'},
  {title:'عن المبادرة',description:'رؤية 967 ورسالتها ومجالات عملها في المعرفة والحوار والمشاركة.',href:'/#about',keywords:'من نحن رؤيتنا رسالتنا'},
  {title:'مشاريعنا',description:'967 في الشارع، مناظرات 967، ومشاريع مجتمعية.',href:'/#projects',keywords:'أنشطة مشاريع مناظرات'},
  {title:'تواصل وشارك',description:'اقتراح موضوع أو شخصية أو شركة، وتصحيح معلومة وطلب إضافة ملف مهني والتطوع.',href:'/contribute',keywords:'تواصل معنا مشاركة مساهمة تطوع اقتراح تصحيح'},
];

export function getSettingsSearchPages(settings) {
  const pages=searchPages.map(page=>{
    if(page.href==='/')return {...page,description:[settings.heroTitle,settings.heroHighlight,settings.heroDescription].filter(Boolean).join(' '),keywords:[page.keywords,settings.heroEyebrow,settings.footerTitle,settings.footerDescription].join(' ')};
    if(page.href==='/#about')return {...page,description:settings.aboutDescription,keywords:[page.keywords,settings.aboutTitle,settings.aboutVision,settings.aboutFields,...settings.aboutTags].join(' ')};
    if(page.href==='/#projects')return {...page,description:page.description+(settings.debatesProjectStatus?' حالة مناظرات 967: '+settings.debatesProjectStatus:'')};
    if(page.href==='/contribute')return {...page,keywords:[page.keywords,settings.headerActionLabel,settings.participationEyebrow,settings.participationTitle,settings.participationButtonLabel].join(' ')};
    return page;
  });
  return [...pages,...contentPagesForSearch(settings.contentPages===null?[]:settings.contentPages??createDefaultContentPages(settings))];
}
