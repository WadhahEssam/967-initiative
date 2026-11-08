import universitiesDataset from '../data/directories/universities.json' with {type:'json'};
import medicalCentersDataset from '../data/directories/medical-centers.json' with {type:'json'};

export const universityTypeLabels={
  university:'جامعة',community_college:'كلية مجتمع',independent_college:'كلية مستقلة',higher_institute:'معهد عالٍ',
  technical_institute:'معهد تقني',vocational_institute:'معهد مهني',specialized_institution:'مؤسسة تعليمية متخصصة',
};
export const medicalTypeLabels={
  referral_hospital:'مستشفى مرجعي / هيئة',specialized_hospital:'مستشفى تخصصي',hospital:'مستشفى',medical_center:'مركز طبي',
  health_center:'مركز صحي',health_unit:'وحدة صحية',medical_complex:'مجمع طبي',specialized_clinic:'عيادة متخصصة',laboratory:'مختبر',diagnostic_center:'مركز أشعة وتشخيص',dental_center:'مركز أسنان',eye_center:'مركز عيون',other:'منشأة صحية أخرى',
};
export const ownershipLabels={government:'حكومي',private:'خاص',community:'أهلي / مجتمعي',civil:'أهلي / مجتمعي',other:'غير محدد'};
export const verificationLabels={verified:'تم التحقق من الهوية والمصدر',incomplete:'معلومات غير مكتملة',needs_review:'يحتاج مراجعة حديثة'};
export const operatingLabels={fully_operational:'كان يعمل بشكل كامل',partially_operational:'كان يعمل بشكل جزئي',not_operational:'غير عامل حسب المصدر',listed_for_admission:'مدرج للتنسيق والقبول',unknown:'حالة التشغيل غير مؤكدة'};

const list=value=>Array.isArray(value)?value:[];
const nullable=value=>value||null;
export function mapUniversity(row){
  return {
    databaseId:row.id||null,id:row.slug,stableKey:row.stable_key,name:row.name_ar,englishName:nullable(row.name_en),type:row.institution_type,
    typeLabel:universityTypeLabels[row.institution_type]||row.institution_type,ownership:row.ownership,ownershipLabel:ownershipLabels[row.ownership]||ownershipLabels.other,
    foundedYear:row.founded_year??null,summary:row.summary||'',governorate:row.governorate||'',city:row.city||'',district:row.district||'',address:row.address||'',
    latitude:row.latitude??null,longitude:row.longitude??null,mapUrl:nullable(row.map_url),logoUrl:nullable(row.logo_url),website:nullable(row.website),phone:nullable(row.phone),email:nullable(row.email),socialLinks:list(row.social_links),
    admissionInfo:row.admission_info||'',tuitionInfo:row.tuition_info||'',tuitionAsOf:nullable(row.tuition_as_of),registrationUrl:nullable(row.registration_url),
    languages:list(row.languages),studyModes:list(row.study_modes),educationLevels:list(row.education_levels),accreditationStatus:row.accreditation_status||'not_asserted',
    accreditingBody:row.accrediting_body||'',operatingStatus:row.operating_status||'unknown',verificationStatus:row.verification_status||'incomplete',verifiedAt:nullable(row.verified_at),
    programs:list(row.programs),branches:list(row.branches),sources:list(row.sources),isPublished:row.is_published!==false,is_published:row.is_published!==false,
    revision:row.revision||1,createdAt:row.created_at||null,updatedAt:row.updated_at||null,deletedAt:row.deleted_at||null,
  };
}
export function mapMedicalCenter(row){
  return {
    databaseId:row.id||null,id:row.slug,stableKey:row.stable_key,officialCode:row.official_code||'',name:row.name_ar,englishName:nullable(row.name_en),type:row.institution_type,
    typeLabel:medicalTypeLabels[row.institution_type]||row.institution_type,ownership:row.ownership,ownershipLabel:ownershipLabels[row.ownership]||ownershipLabels.other,operatorName:row.operator_name||'',
    summary:row.summary||'',governorate:row.governorate||'',city:row.city||'',district:row.district||'',address:row.address||'',latitude:row.latitude??null,longitude:row.longitude??null,mapUrl:nullable(row.map_url),
    logoUrl:nullable(row.logo_url),website:nullable(row.website),phone:nullable(row.phone),emergencyPhone:nullable(row.emergency_phone),email:nullable(row.email),socialLinks:list(row.social_links),bookingUrl:nullable(row.booking_url),
    emergencyAvailable:typeof row.emergency_available==='boolean'?row.emergency_available:null,operatingStatus:row.operating_status||'unknown',operatingStatusAsOf:nullable(row.operating_status_as_of),
    verificationStatus:row.verification_status||'needs_review',verifiedAt:nullable(row.verified_at),facilityPresence:row.facility_presence||'',careLevel:row.care_level||'',accessStatus:row.access_status||'',
    buildingStatus:row.building_status||'',equipmentStatus:row.equipment_status||'',specialties:list(row.specialties),services:list(row.services),hours:list(row.hours),branches:list(row.branches),sources:list(row.sources),
    isPublished:row.is_published!==false,is_published:row.is_published!==false,revision:row.revision||1,createdAt:row.created_at||null,updatedAt:row.updated_at||null,deletedAt:row.deleted_at||null,
  };
}

export const fallbackUniversities=universitiesDataset.records.filter(row=>row.is_published!==false).map(mapUniversity);
export const fallbackMedicalCenters=medicalCentersDataset.records.filter(row=>row.is_published!==false).map(mapMedicalCenter);

export function institutionSearchFields(item,kind){
  if(kind==='university')return [item.name,item.englishName,item.summary,item.governorate,item.city,item.district,item.typeLabel,item.ownershipLabel,...item.educationLevels,...item.studyModes,...item.programs.flatMap(program=>[program.name,program.field,program.faculty,program.department,program.qualification,program.language,program.study_mode,program.level])];
  return [item.name,item.englishName,item.summary,item.governorate,item.city,item.district,item.typeLabel,item.ownershipLabel,...item.specialties.map(row=>row.name),...item.services.flatMap(row=>[row.name,row.details])];
}

export function relatedInstitutions(current,items,kind,limit=3){
  return items.filter(item=>item.id!==current.id).map(item=>({item,score:(item.governorate&&item.governorate===current.governorate?3:0)+(item.type===current.type?2:0)+(kind==='university'&&item.programs.some(program=>current.programs.some(value=>value.field&&value.field===program.field))?1:0)+(kind==='medical'&&item.specialties.some(row=>current.specialties.some(value=>value.name===row.name))?1:0)})).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name,'ar')).slice(0,limit).map(row=>row.item);
}

const has=value=>Array.isArray(value)?value.length>0:value!==null&&value!==undefined&&String(value).trim()!=='';
const relationHasSource=rows=>list(rows).some(row=>has(row.source_url||row.sourceUrl));
const evidencePeriod=value=>{
 const text=String(value||'').trim();let match;
 if((match=text.match(/^(\d{4})$/)))return {label:text,precision:'year',sort:Number(match[1])*12+11,year:Number(match[1]),month:null};
 if((match=text.match(/^(\d{4})-(\d{2})$/))){const month=Number(match[2]);return month>=1&&month<=12?{label:text,precision:'month',sort:Number(match[1])*12+month-1,year:Number(match[1]),month}:null;}
 if((match=text.match(/^(\d{4})-(\d{2})-(\d{2})$/))){const date=new Date(`${text}T12:00:00Z`);return Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==text?null:{label:text,precision:'day',sort:date.getUTCFullYear()*12+date.getUTCMonth(),year:date.getUTCFullYear(),month:date.getUTCMonth()+1};}
 if((match=text.match(/^(\d{4})[\/-](\d{4})$/))){const start=Number(match[1]),end=Number(match[2]);return end===start+1?{label:text,precision:'academic-year',sort:end*12+5,year:end,month:6}:null;}
 return null;
};
export function latestEvidenceDate(item){
 const periods=list(item.sources).flatMap(source=>[source.source_published_at,source.status_as_of,source.information_verified_at,source.verified_at]).map(evidencePeriod).filter(Boolean).sort((a,b)=>a.sort-b.sort);
 return periods.at(-1)||null;
}

export function directoryFallbackAllowed(env=process.env){return env.NODE_ENV!=='production';}

export function institutionCompleteness(item,kind,asOf=new Date()){
 const medical=kind==='medical',programs=list(item.programs),specialties=list(item.specialties),services=list(item.services),sources=list(item.sources);
 const identity=[item.name||item.name_ar,item.type||item.institution_type,item.governorate].filter(has).length;
 const contact=[item.phone,item.email,item.website].filter(has).length;
 const hasCoordinates=has(item.latitude)&&has(item.longitude)&&Number.isFinite(Number(item.latitude))&&Number.isFinite(Number(item.longitude));
 const depth=medical?Math.round((specialties.length?12:0)+(services.length?13:0)):(programs.length?25:0);
 const sourceDepth=medical?relationHasSource(specialties)||relationHasSource(services):relationHasSource(programs);
 const evidence=latestEvidenceDate(item),asOfMonth=asOf.getUTCFullYear()*12+asOf.getUTCMonth(),evidenceAgeMonths=evidence?asOfMonth-evidence.sort:Infinity;
 const conflicts=sources.some(source=>has(source.conflict_note)||/تضارب|conflict/i.test(source.note||''));
 const verified=(item.verificationStatus||item.verification_status)==='verified';
 const dimensions={
  identity:{score:identity*5,max:15},contact:{score:contact*5,max:15},location:{score:(has(item.address)?7:0)+(has(item.mapUrl||item.map_url)||hasCoordinates?8:0),max:15},
  offerings:{score:Math.min(20,Math.round(depth*.8)),max:20},evidence:{score:(sources.length?5:0)+(sourceDepth?10:0),max:15},freshness:{score:evidence&&evidenceAgeMonths<=24?10:0,max:10},
  review:{score:verified?5:0,max:5},consistency:{score:conflicts?0:5,max:5},
 };
 const score=Object.values(dimensions).reduce((sum,row)=>sum+row.score,0);
 const warnings=[];
 if(!contact)warnings.push('دون وسيلة تواصل');
 if(!has(item.address))warnings.push('دون عنوان تفصيلي');
 if(!has(item.mapUrl||item.map_url)&&!hasCoordinates)warnings.push('دون موقع دقيق');
 if(!depth)warnings.push(medical?'دون تخصصات أو خدمات موثقة':'دون برامج موثقة');
 if(!evidence||evidenceAgeMonths>24)warnings.push('مصادر قديمة أو غير مؤرخة');
 if(!verified)warnings.push('البيانات تحتاج مراجعة');
 if(conflicts)warnings.push('يتضمن تضاربًا يحتاج مراجعة');
 return {score,warnings,evidenceDate:evidence?.label||null,evidencePrecision:evidence?.precision||null,dimensions};
}

// What the directory list needs on the phone: card text, filters and search. Each record's
// sources, branches, hours, contacts and long descriptions are only shown on its own page;
// sending them with the list made /universities and /medical-centers about 280 KB compressed.
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row?.[key]!==undefined).map(key=>[key,row[key]]));
const LIST_FIELDS=['id','name','englishName','summary','governorate','city','district','type','typeLabel','ownership','ownershipLabel','logoUrl','createdAt','updatedAt','verifiedAt'];
const PROGRAM_FIELDS=['name','field','faculty','department','qualification','language','study_mode','level'];
export function institutionListItems(items,kind){
  return (items||[]).map(item=>kind==='university'
    ?{...pick(item,LIST_FIELDS),educationLevels:item.educationLevels||[],studyModes:item.studyModes||[],programs:(item.programs||[]).map(row=>pick(row,PROGRAM_FIELDS))}
    :{...pick(item,[...LIST_FIELDS,'emergencyAvailable','operatingStatus','operatingStatusAsOf']),specialties:(item.specialties||[]).map(row=>pick(row,['name'])),services:(item.services||[]).map(row=>pick(row,['name','details']))});
}
