import 'server-only';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {cache} from 'react';
import {fetchAllRows} from './pagination';
import {DISTRICT_PROFILE_PREFIX,buildDistrictProfile,validateDistrictProfile} from './districtProfiles';
import {readPublicSetting,writeEditorialSetting} from './publicSettingRepository';
import {RequestValidationError} from './requestSecurity';
import {reviewedDistrictProfiles} from './reviewedDistrictProfiles';
import {createMemo} from './serverMemo.js';

export const getMapBoundaries=cache(async()=>JSON.parse(await readFile(path.join(process.cwd(),'public/data/yemen-map/yemen-boundaries.json'),'utf8')));
export async function readDistrictEditor(db,id){
 const boundaries=await getMapBoundaries(),region=boundaries.districts.find(item=>item.id===id);
 if(!region)throw new RequestValidationError('المديرية غير موجودة في فهرس الأماكن.',404);
 const [base,saved]=await Promise.all([db.from('districts').select('*').eq('id',id).maybeSingle(),readPublicSetting(db,DISTRICT_PROFILE_PREFIX+id)]);
 if(base.error)throw new RequestValidationError('تعذر تحميل الملف الأساسي للمديرية.',503);
 const original=buildDistrictProfile(region,base.data||{},reviewedDistrictProfiles[id]);
 if(saved.value&&saved.value.version!==1)throw new RequestValidationError('نسخة ملف المديرية غير مدعومة. لا تحفظ فوقها.',503);
 return {region,item:saved.value?validateDistrictProfile(saved.value.profile):original,base:original,revision:saved.revision};
}
export async function saveDistrictEditor(db,id,input,revision,actorId){
 const current=await readDistrictEditor(db,id);
 if(current.revision!==revision)throw new RequestValidationError('عُدّل ملف المديرية في جلسة أخرى. أعد تحميل المحفوظ قبل الحفظ.',409);
 const item=validateDistrictProfile(input);
 const result=await writeEditorialSetting(db,DISTRICT_PROFILE_PREFIX+id,{version:1,profile:item},revision,actorId);
 publicMapProfilesMemo.clear();
 return {...current,item,revision:result.revision};
}
// The full set is about 1.2 MB from Supabase (governorates, districts and 335 saved profiles), and
// every map visit used to read it again. Kept for 10 minutes; saving a district clears it at once.
// Governorates and districts are only changed by maintenance scripts, so 10 minutes is the delay there.
// If Supabase fails, the last copy is served for up to 6 hours.
const publicMapProfilesMemo=createMemo({ttlMs:10*60*1000,staleMs:6*60*60*1000});
export function readPublicMapProfiles(db){
 if(!db)return loadPublicMapProfiles(db);
 return publicMapProfilesMemo(()=>loadPublicMapProfiles(db));
}
async function loadPublicMapProfiles(db){
 const boundaries=await getMapBoundaries();
 const [governorates,districts,supplements]=db?await Promise.all([
  fetchAllRows(()=>db.from('governorates').select('*',{count:'exact'}).order('id')),
  fetchAllRows(()=>db.from('districts').select('*',{count:'exact'}).order('id')),
  fetchAllRows(()=>db.from('site_settings').select('key,value',{count:'exact'}).like('key',DISTRICT_PROFILE_PREFIX+'%').order('key')),
 ]):[[],[],[]];
 const profiles=Object.fromEntries(governorates.map(row=>[row.id,row])),base=new Map(districts.map(row=>[row.id,row])),saved=new Map(supplements.map(row=>[row.key,row.value]));
 for(const region of boundaries.districts){const entry=saved.get(DISTRICT_PROFILE_PREFIX+region.id);if(entry&&entry.version!==1)throw new RequestValidationError('تعذر قراءة بعض ملفات المديريات.',503);profiles[region.id]={id:region.id,name_ar:region.nameAr,...(entry?validateDistrictProfile(entry.profile):buildDistrictProfile(region,base.get(region.id),reviewedDistrictProfiles[region.id]))};}
 return profiles;
}
