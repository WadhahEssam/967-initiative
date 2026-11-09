import 'server-only';
import {getMapBoundaries,readPublicMapProfiles} from '../mapProfileRepository';
import {publicDb} from '../supabase';
import {yemenGovernorates} from '../yemeniFigures';
import {displayPlaceName,normalizePlaceName} from '../districtPages';
import {createMemo} from '../serverMemo.js';

// Governorates and districts for the market's location fields, with the site's spelling
// («صنعاء القديمة», not the boundary file's «صنعاء القديمه»). Built once an hour.
const memo=createMemo({ttlMs:60*60*1000,staleMs:24*60*60*1000});
export function getMarketPlaces(){
 return memo(async()=>{
  const [boundaries,profiles]=await Promise.all([getMapBoundaries(),readPublicMapProfiles(publicDb()).catch(()=>({}))]);
  const names=Object.fromEntries(yemenGovernorates.map(item=>[item.id,item.name]));
  const governorates=boundaries.governorates.map(item=>({id:item.id,name:names[item.id]||item.nameAr})).sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  const districts=boundaries.districts.map(item=>({id:item.id,governorateId:item.governorateId,name:displayPlaceName(item.nameAr,[profiles[item.id]?.description,profiles[item.id]?.history])}))
   .sort((a,b)=>a.name.localeCompare(b.name,'ar'));
  return {governorates,districts};
 });
}
export function placeChecks({governorates,districts}){
 const govIds=new Set(governorates.map(item=>item.id)),districtGov=new Map(districts.map(item=>[item.id,item.governorateId]));
 return {isGovernorate:id=>govIds.has(id),districtGovernorate:id=>districtGov.get(id)||null};
}
export function placeNames({governorates,districts},governorateId,districtId){
 return {governorate:governorates.find(item=>item.id===governorateId)?.name||'',district:districts.find(item=>item.id===districtId)?.name||''};
}
// account_preferences.governorate holds a name («عدن»); the market uses the map id («YE24»).
export function governorateIdByName({governorates},name){
 const key=normalizePlaceName(name);
 return key?governorates.find(item=>normalizePlaceName(item.name)===key)?.id||null:null;
}
