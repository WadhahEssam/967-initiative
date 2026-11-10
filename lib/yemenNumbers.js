import {rankSearchResults} from './search.js';
export const statSections = [
  {
    slug: 'economy-finance',
    name: 'الاقتصاد والمالية',
    description: 'مؤشرات الاقتصاد الكلي والأسعار والعمل والمالية العامة والتجارة والاستثمار.',
    domains: [
      ['gdp', 'الناتج المحلي الإجمالي'],
      ['inflation-prices', 'التضخم والأسعار'],
      ['labor-unemployment', 'سوق العمل والبطالة'],
      ['poverty', 'الفقر'],
      ['public-finance', 'المالية العامة'],
      ['taxes-customs', 'الضرائب والجمارك'],
      ['currency-monetary', 'العملة والسياسة النقدية'],
      ['banking', 'القطاع المصرفي'],
      ['foreign-trade', 'التجارة الخارجية'],
      ['investment', 'الاستثمار'],
      ['remittances', 'تحويلات المغتربين'],
      ['public-debt', 'الدين العام'],
    ],
  },
  {
    slug: 'population-society',
    name: 'السكان والمجتمع',
    description: 'صورة وطنية عن السكان وخصائصهم الديموغرافية والاجتماعية وحركتهم.',
    domains: [
      ['population', 'السكان'],
      ['age-structure', 'التركيب العمري'],
      ['births-deaths', 'المواليد والوفيات'],
      ['family-marriage', 'الأسرة والزواج'],
      ['women', 'المرأة'],
      ['youth', 'الشباب'],
      ['disability', 'الإعاقة'],
      ['migration-diaspora', 'الهجرة والاغتراب'],
    ],
  },
  {
    slug: 'education-knowledge',
    name: 'التعليم والمعرفة',
    description: 'مؤشرات التعليم النظامي والمهني والبحث والمهارات المعرفية والرقمية.',
    domains: [
      ['schools', 'التعليم المدرسي'],
      ['literacy', 'محو الأمية'],
      ['higher-education', 'التعليم العالي'],
      ['vocational-education', 'التعليم الفني والمهني'],
      ['research', 'البحث العلمي'],
      ['digital-skills', 'المهارات الرقمية'],
    ],
  },
  {
    slug: 'health-food',
    name: 'الصحة والغذاء',
    description: 'مؤشرات الصحة والخدمات والأمراض والتغذية والأمن الغذائي على المستوى الوطني.',
    domains: [
      ['public-health', 'الصحة العامة'],
      ['hospitals-services', 'المستشفيات والخدمات الصحية'],
      ['diseases-epidemics', 'الأمراض والأوبئة'],
      ['maternal-child-health', 'صحة الأم والطفل'],
      ['nutrition', 'التغذية'],
      ['food-security', 'الأمن الغذائي'],
    ],
  },
  {
    slug: 'infrastructure-services',
    name: 'البنية التحتية والخدمات',
    description: 'الوصول الوطني إلى الخدمات الأساسية وشبكات النقل والاتصال والسكن.',
    domains: [
      ['electricity', 'الكهرباء'],
      ['household-water', 'مياه الأسر'],
      ['sanitation', 'الصرف الصحي'],
      ['internet-telecom', 'الإنترنت والاتصالات'],
      ['roads-transport', 'الطرق والنقل'],
      ['ports-airports', 'الموانئ والمطارات'],
      ['housing', 'الإسكان'],
      ['waste-cleanliness', 'النفايات والنظافة'],
    ],
  },
  {
    slug: 'production-resources',
    name: 'الإنتاج والموارد',
    description: 'الموارد والقطاعات الإنتاجية التي تشكل الاقتصاد الحقيقي في اليمن.',
    domains: [
      ['agriculture', 'الزراعة'],
      ['livestock', 'الثروة الحيوانية'],
      ['fisheries', 'الثروة السمكية'],
      ['qat', 'القات'],
      ['oil-gas', 'النفط والغاز'],
      ['mining', 'التعدين'],
      ['manufacturing', 'الصناعة التحويلية'],
      ['renewable-energy', 'الطاقة المتجددة'],
    ],
  },
  {
    slug: 'environment-climate',
    name: 'البيئة والمناخ',
    description: 'المياه والمناخ والمخاطر الطبيعية والأنظمة البيئية في اليمن.',
    domains: [
      ['water-resources', 'الموارد المائية'],
      ['climate', 'المناخ'],
      ['desertification', 'التصحر'],
      ['natural-disasters', 'الكوارث الطبيعية'],
      ['biodiversity', 'التنوع الحيوي'],
    ],
  },
  {
    slug: 'war-humanitarian',
    name: 'الحرب والوضع الإنساني',
    description: 'آثار الحرب والاحتياجات الإنسانية والنزوح والمساعدات ومخاطر الألغام.',
    domains: [
      ['war-impact', 'آثار الحرب'],
      ['displacement-refugees', 'النزوح واللجوء'],
      ['humanitarian-needs', 'الاحتياجات الإنسانية'],
      ['international-aid', 'المساعدات الدولية'],
      ['mines-erw', 'الألغام ومخلفات الحرب'],
    ],
  },
  {
    slug: 'state-institutions',
    name: 'الدولة والمؤسسات',
    description: 'مؤشرات الحوكمة وجودة المؤسسات والنزاهة والشفافية.',
    domains: [
      ['governance', 'الحوكمة'],
      ['corruption-transparency', 'الفساد والشفافية'],
    ],
  },
  {
    slug: 'culture-creativity',
    name: 'الثقافة والمجتمع والإبداع',
    description: 'الحياة الثقافية والإبداعية والرياضية والريادية في اليمن.',
    domains: [
      ['tourism-heritage', 'السياحة والتراث'],
      ['sports', 'الرياضة'],
      ['culture-media', 'الثقافة والإعلام'],
      ['entrepreneurship-tech', 'ريادة الأعمال والتقنية'],
    ],
  },
].map((section, sectionIndex) => ({
  ...section,
  display_order: sectionIndex + 1,
  domains: section.domains.map(([slug, name], domainIndex) => ({
    slug,
    name,
    description: `مؤشرات وطنية موثقة حول ${name}.`,
    display_order: domainIndex + 1,
    section_slug: section.slug,
  })),
}));

export const statDomains = statSections.flatMap(section =>
  section.domains.map(domain => ({...domain, section: {...section, domains: undefined}})),
);

export const directionLabels = {
  increase: 'الارتفاع أفضل',
  decrease: 'الانخفاض أفضل',
  neutral: 'محايد',
  contextual: 'يعتمد على السياق',
};

export const statusLabels = {
  complete: 'مكتملة',
  partial: 'جزئية',
  limited: 'محدودة',
  discontinued: 'متوقفة',
};

export const valueStatusLabels = {official: 'رسمي', estimated: 'تقديري'};

export function getFallbackSections() {
  return statSections.map(section => ({
    ...section,
    id: section.slug,
    isFallback: true,
    domains: section.domains.map(domain => ({...domain, id: domain.slug, isFallback: true})),
  }));
}

export function getFallbackDomain(slug) {
  const domain = statDomains.find(item => item.slug === slug);
  return domain ? {...domain, id: domain.slug, isFallback: true} : null;
}

export function normalizeIndicator(row, values = []) {
  const usable = values.filter(item => item.value !== null && item.value !== undefined && String(item.value).trim() !== '' && Number.isFinite(Number(item.value)) && item.year !== null && item.year !== undefined && String(item.year).trim() !== '' && Number.isInteger(Number(item.year)) && Number(item.year) > 0 && item.is_published !== false && item.national_scope !== false);
  const sourceIds = new Set(usable.map(value => value.source_id));
  const hasSourceConflict = sourceIds.size > 1 && !row.adopted_source_id;
  const adoptedValues = row.adopted_source_id
    ? usable.filter(value => value.source_id === row.adopted_source_id)
    : hasSourceConflict ? [] : usable;
  const sortedValues = [...adoptedValues].sort((a, b) => Number(a.year) - Number(b.year));
  return {
    ...row,
    values: sortedValues,
    allValues: [...usable].sort((a, b) => Number(a.year) - Number(b.year)),
    hasSourceConflict,
    latestValue: sortedValues.at(-1) || null,
    firstValue: sortedValues[0] || null,
  };
}

export function fillAnnualGaps(values, fromYear, toYear) {
  if (!values?.length) return [];
  const byYear = new Map(values.map(item => [Number(item.year), item]));
  const start = Number(fromYear ?? values[0].year);
  const end = Number(toYear ?? values.at(-1).year);
  return Array.from({length: Math.max(0, end - start + 1)}, (_, index) => {
    const year = start + index;
    return byYear.get(year) || {year, value: null, missing: true};
  });
}

export function csvEscape(value) {
  let text = String(value ?? '');
  // Keep actual numeric measurements numeric; CMS labels must not become
  // spreadsheet formulas when a visitor opens the exported CSV.
  if (typeof value !== 'number' && /^[\s]*[=+\-@\t\r]/.test(text) && !/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) text = "'" + text;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Card-sized projection for the public indicator list. The list page used to
// serialize every value (with its joined source) of every indicator into the
// client explorer; it needs only the latest adopted value, the measured years
// for the year filter, and short descriptive text for search.
export function indicatorListItem(item) {
  const pickSource = source => source ? {name: source.name || null, url: source.url || null} : null;
  const latest = item.latestValue;
  const clip = (text, length) => typeof text === 'string' && text.length > length ? text.slice(0, length) : text || null;
  return {
    id: item.id, slug: item.slug, name: item.name, unit: item.unit || '',
    short_description: clip(item.short_description, 320), definition: clip(item.definition, 240),
    data_status: item.data_status, domain_id: item.domain_id,
    domain: item.domain ? {id: item.domain.id, slug: item.domain.slug, name: item.domain.name, section: item.domain.section ? {name: item.domain.section.name} : null} : null,
    hasSourceConflict: Boolean(item.hasSourceConflict),
    adopted_source: pickSource(item.adopted_source),
    latestValue: latest ? {value: latest.value, year: latest.year, value_status: latest.value_status, source: pickSource(latest.source)} : null,
    years: [...new Set((item.values || []).map(value => Number(value.year)))],
    spark: (item.values || []).slice(-16).map(value => ({year: Number(value.year), value: Number(value.value)})),
  };
}

// /yemen-in-numbers sends indicatorIndexItem for every indicator (filters, search, card heading)
// and the card details (latest value, source, trend line) only for the first page of cards;
// /api/numbers/details brings the rest after the page loads.
const CARD_DETAIL_KEYS = ['latestValue', 'adopted_source', 'spark'];
export function indicatorIndexItem(listItem) {
  return Object.fromEntries(Object.entries(listItem).filter(([key]) => !CARD_DETAIL_KEYS.includes(key)));
}
export function indicatorCardDetailsMap(listItems) {
  return Object.fromEntries(listItems.map(item => [item.id, Object.fromEntries(CARD_DETAIL_KEYS.map(key => [key, item[key] ?? null]))]));
}
// Filters and order shared by the explorer and the page that picks the first page's details.
export function filterIndicatorList(indicators, {q = '', domain = 'all', year = 'all'} = {}) {
  const candidates = indicators.filter(item => (domain === 'all' || item.domain_id === domain)
    && (year === 'all' || (item.years || []).some(value => String(value) === year)))
    .map(item => ({indicator: item, title: item.name, description: item.short_description,
      meta: item.domain?.name, searchText: [item.definition, item.domain?.section?.name].filter(Boolean).join(' ')}));
  return rankSearchResults(q, candidates).map(item => item.indicator);
}
