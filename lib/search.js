import {toLatinDigits} from './format.js';

export function normalizeSearch(value) {
  return toLatinDigits(value).normalize('NFKC').toLocaleLowerCase('ar')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}
function searchTokens(query = '') {
  const tokens = [];
  for (const match of String(query).slice(0, 150).matchAll(/(-?)"([^"]+)"|(-?)([^\s"]+)/g)) {
    const negative = match[1] === '-' || match[3] === '-';
    const text = normalizeSearch(match[2] ?? match[4]);
    if (!text) continue;
    const exact = match[2] !== undefined;
    for (const term of exact ? [text] : text.split(' ')) tokens.push({text: term, negative, exact});
  }
  return tokens;
}
export function parseSearchQuery(query = '') {
  const tokens = searchTokens(query);
  return {terms: tokens.filter(token => !token.negative).map(token => token.text), excluded: tokens.filter(token => token.negative).map(token => token.text)};
}
function containsTerm(text, token) {
  // Allow السكان to find سكان; quoted terms and phrases retain exact matching.
  return text.includes(token.text) || (!token.exact && /^ال[\u0621-\u064a]{3,}$/.test(token.text) && text.includes(token.text.slice(2)));
}
export function matchesSearch(query, fields, {mode = 'all', exclude = ''} = {}) {
  // Keep fields separate: a quoted phrase must not straddle two unrelated fields.
  const texts = (Array.isArray(fields) ? fields : [fields]).map(normalizeSearch);
  const tokens = searchTokens(query), terms = tokens.filter(token => !token.negative);
  const forbidden = [...tokens.filter(token => token.negative), ...searchTokens(exclude).filter(token => !token.negative)];
  const contains = term => texts.some(text => containsTerm(text, term));
  if (forbidden.some(contains)) return false;
  if (!terms.length) return true;
  if (mode === 'phrase') return texts.some(text => text.includes(terms.map(term => term.text).join(' ')));
  return mode === 'any' ? terms.some(contains) : terms.every(contains);
}
export function matchesSearchResult(query, item, options = {}) {
  return matchesSearch(query, options.scope === 'title' ? item.title : [item.title, item.description, item.meta, item.searchText], options);
}
export function rankSearchResults(query, items, options = {}) {
  const terms = searchTokens(query).filter(token => !token.negative);
  const phrase = terms.map(term => term.text).join(' ');
  return items.map((item, index) => {
    if (!matchesSearchResult(query, item, options)) return null;
    const title = normalizeSearch(item.title), meta = normalizeSearch(item.meta), description = normalizeSearch(item.description);
    const score = (phrase && title === phrase ? 2000 : phrase && title.startsWith(phrase) ? 1000 : 0)
      + terms.reduce((sum, term) => sum + (containsTerm(title, term) ? 120 : containsTerm(meta, term) ? 25 : containsTerm(description, term) ? 10 : 1), 0);
    return {item, score, index};
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index).map(row => row.item);
}
export const searchTypes = {all:'كل المحتوى',works:'الأعمال الإعلامية',debates:'المناظرات',issues:'المجلة',indicators:'المؤشرات',figures:'الشخصيات',history:'تاريخ اليمن',companies:'الشركات والمنتجات',professionals:'المهنيون',universities:'الجامعات والمعاهد',medicalCenters:'المراكز الطبية',places:'المحافظات والمديريات',domains:'مجالات المرصد',pages:'صفحات المنصة',members:'الأعضاء'};

// Index only records returned by public-page loaders. Visible examples stay discoverable
// with their labels; drafts and private/contact fields are never indexed.
export function buildSearchIndex({works=[],debates=[],issues=[],indicators=[],figures=[],companies=[],professionals=[],universities=[],medicalCenters=[],sections=[],places=[],history=[],pages=[]}) {
  const visible = items => items.filter(item=>item.is_published !== false);
  const result = (item, fields, text=[]) => ({...fields,isDemo:Boolean(item.isDemo||item.is_demo),searchText:text.flat().filter(value=>value!==null&&value!==undefined).join(' ')});
  return [
    ...debates.filter(d=>['published','archived'].includes(d.publication_status)).map(x=>result(x,{type:'debates',title:x.title,description:x.question,meta:x.category,href:'/debates/'+encodeURIComponent(x.slug)},[x.description,...(x.axes||[]),...(x.participants||[]).map(p=>p.speaker?.name)])),
    ...visible(works).filter(x=>!x.debate_id).map(x=>result(x,{type:'works',title:x.title,description:x.summary,meta:[x.category,x.platform].filter(Boolean).join(' · '),href:'/works/'+encodeURIComponent(x.slug)},[x.published_at])),
    ...visible(issues).map(x=>result(x,{type:'issues',title:x.title,description:x.summary,meta:x.is_demo?'ملف توضيحي للقارئ':`العدد ${x.number}`,href:'/magazine/'+encodeURIComponent(x.slug)},[x.issue_date,...(Array.isArray(x.contents)?x.contents.filter(y=>typeof y==='string'):[])])),
    ...visible(indicators).map(x=>result(x,{type:'indicators',title:x.name,description:x.short_description||x.definition,meta:x.domain?.name,href:'/yemen-in-numbers/indicator/'+encodeURIComponent(x.slug)},[x.definition,x.measurement_method,x.unit,x.domain?.section?.name,x.adopted_source?.name,x.latestValue?.source?.name])),
    ...history.filter(x=>x.isPublished!==false).map(x=>result(x,{type:'history',title:x.title,description:x.summary,meta:x.period,href:'/yemen-history/'+encodeURIComponent(x.slug)},[x.kind,x.era,x.location,...(x.paragraphs||[])])),
    ...visible(figures).map(x=>result(x,{type:'figures',title:x.fullName,description:x.shortBio||x.knownFor,meta:[x.field,x.governorateName].filter(Boolean).join(' · '),href:'/yemeni-figures/'+encodeURIComponent(x.slug)},[x.knownFor,x.era,x.birthYear,x.deathYear,...(x.timeline||[]).flatMap(y=>[y.title,y.description,y.year])])),
    ...visible(companies).map(x=>result(x,{type:'companies',title:x.name,description:x.summary,meta:[x.category,x.location,...(x.products||[])].filter(Boolean).join(' · '),href:'/yemeni-products/'+encodeURIComponent(x.id)},[x.legalName,x.story,x.impact,x.entityType,...(x.strengths||[]),...(x.markets||[]),...(x.productDetails||[]).flatMap(y=>[y.name,y.description,y.format])])),
    ...visible(professionals).map(x=>result(x,{type:'professionals',title:x.fullName,description:x.bio,meta:[x.professionTitle,x.category,x.location,...(x.services||[]),...(x.skills||[])].filter(Boolean).join(' · '),href:'/professionals/'+encodeURIComponent(x.id)},[x.serviceMode,x.availability,...(x.serviceAreas||[]),...(x.languages||[])])),
    ...visible(universities).map(x=>result(x,{type:'universities',title:x.name,description:x.summary,meta:[x.typeLabel,x.ownershipLabel,x.governorate,x.city].filter(Boolean).join(' · '),href:'/universities/'+encodeURIComponent(x.id)},[x.englishName,x.district,...(x.educationLevels||[]),...(x.studyModes||[]),...(x.programs||[]).flatMap(row=>[row.name,row.field,row.faculty,row.department,row.qualification])])),
    ...visible(medicalCenters).map(x=>result(x,{type:'medicalCenters',title:x.name,description:x.summary,meta:[x.typeLabel,x.ownershipLabel,x.governorate,x.city].filter(Boolean).join(' · '),href:'/medical-centers/'+encodeURIComponent(x.id)},[x.englishName,x.district,...(x.specialties||[]).map(row=>row.name),...(x.services||[]).flatMap(row=>[row.name,row.details])])),
    ...visible(sections).flatMap(section=>visible(section.domains||[]).map(x=>result(x,{type:'domains',title:x.name,description:x.description,meta:section.name,href:'/yemen-in-numbers/'+encodeURIComponent(x.slug)},[section.description]))),
    ...visible(places).map(x=>result(x,{type:'places',title:x.nameAr,description:x.description,meta:[x.kind==='district'?'مديرية':'محافظة',x.governorateNameAr].filter(Boolean).join(' · '),href:x.kind==='district'?'/yemen-map/districts/'+encodeURIComponent(x.id):'/yemen-map?'+new URLSearchParams({region:x.id})+'#map'},[x.nameEn,x.pcode,x.capital,x.history,x.geography,x.landmarks,x.economy])),
    ...visible(pages).map(x=>result(x,{...x,type:'pages'},[x.keywords])),
  ];
}
