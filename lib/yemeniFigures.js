export const yemenGovernorates = [
  {id: 'YE12', name: 'أبين'},
  {id: 'YE30', name: 'الضالع'},
  {id: 'YE24', name: 'عدن'},
  {id: 'YE14', name: 'البيضاء'},
  {id: 'YE18', name: 'الحديدة'},
  {id: 'YE16', name: 'الجوف'},
  {id: 'YE28', name: 'المهرة'},
  {id: 'YE27', name: 'المحويت'},
  {id: 'YE29', name: 'عمران'},
  {id: 'YE20', name: 'ذمار'},
  {id: 'YE19', name: 'حضرموت'},
  {id: 'YE17', name: 'حجة'},
  {id: 'YE11', name: 'إب'},
  {id: 'YE25', name: 'لحج'},
  {id: 'YE26', name: 'مأرب'},
  {id: 'YE31', name: 'ريمة'},
  {id: 'YE22', name: 'صعدة'},
  {id: 'YE23', name: 'صنعاء'},
  {id: 'YE13', name: 'أمانة العاصمة'},
  {id: 'YE21', name: 'شبوة'},
  {id: 'YE32', name: 'سقطرى'},
  {id: 'YE15', name: 'تعز'},
];

export const yemeniFigureFields = [
  'الأدب والشعر',
  'الإعلام وحقوق الإنسان',
  'الإعلام والصحافة',
  'المجتمع وحقوق الإنسان',
  'السياسة والحكم',
  'الفن والموسيقى',
  'الفنون البصرية والسينما',
  'البحث والسياسات العامة',
  'العلم والتعليم',
  'الرياضة',
  'الاقتصاد وريادة الأعمال',
  'التراث والتاريخ',
];

export const yemeniFigureEras = ['معاصرة', 'تاريخية'];

export function mapYemeniFigure(row) {
  return {
    id: row.id,
    slug: row.slug,
    fullName: row.full_name,
    knownFor: row.known_for || '',
    field: row.field,
    governorateId: row.governorate_id || '',
    governorateName: row.governorate_name || '',
    era: row.era,
    birthYear: row.birth_year,
    deathYear: row.death_year,
    shortBio: (row.short_bio || '').split(/\n\s*\n/)[0].slice(0,650),
    biographyText: row.short_bio || '',
    imageUrl: row.image_url || '',
    imageCredit: row.image_credit || '',
    imageSourceUrl: row.image_source_url || '',
    imageKind: /^(صورة سياقية|تصوير فني|وثيقة)/.test(row.image_credit||'')?'context':'portrait',
    website: row.website || '',
    facebookUrl: row.facebook_url || '',
    instagramUrl: row.instagram_url || '',
    xUrl: row.x_url || '',
    youtubeUrl: row.youtube_url || '',
    displayOrder: row.display_order || 0,
    createdAt: row.created_at || null,
    sources: Array.isArray(row.sources) ? row.sources.filter(item=>item?.title && /^https?:\/\//.test(item.url||'')) : [],
    timeline: Array.isArray(row.timeline) ? row.timeline.filter(item=>item?.title && item.year) : [],
  };
}

export function toFigureDirectoryCard(figure){
 return Object.fromEntries(['id','slug','fullName','knownFor','field','governorateId','governorateName','era','birthYear','deathYear','shortBio','imageUrl','imageCredit','imageKind','imageSourceUrl','displayOrder','createdAt','isDemo','website','facebookUrl','instagramUrl','xUrl','youtubeUrl'].map(key=>[key,figure[key]]));
}

// /yemeni-figures sends toFigureIndexEntry for every figure (enough for filters, counts and
// sorting) and toFigureDetails only for the first cards; /api/figures/details brings the rest.
const figureSocialKeys=['website','facebookUrl','instagramUrl','xUrl','youtubeUrl'];
const present=row=>Object.fromEntries(Object.entries(row).filter(([,value])=>value!==undefined&&value!==null&&value!==''&&value!==false));
export function toFigureIndexEntry(figure){
 const {slug,fullName,field,governorateId,era,birthYear,deathYear,createdAt,isDemo}=figure;
 return present({slug,fullName,field,governorateId,era,birthYear,deathYear,createdAt,isDemo,
  hasPhoto:Boolean(figure.imageUrl),hasSocial:figureSocialKeys.some(key=>figure[key])});
}
export function toFigureDetails(figure){
 const {id,knownFor,shortBio,imageUrl,imageCredit,imageKind,imageSourceUrl,governorateName}=figure;
 return present({id,knownFor,shortBio,imageUrl,imageCredit,imageKind,imageSourceUrl,governorateName,...Object.fromEntries(figureSocialKeys.map(key=>[key,figure[key]]))});
}
export function figureDetailsMap(figures){
 return Object.fromEntries((figures||[]).map(figure=>[figure.slug,toFigureDetails(figure)]));
}

// Existing editorial catalog remains available. A CMS draft suppresses its catalog counterpart.
export function mergePublicFigures(stored, catalog, publicationStates) {
  const known = new Set(publicationStates.map(item=>item.slug));
  return [...stored, ...catalog.filter(item=>!known.has(item.slug))];
}
