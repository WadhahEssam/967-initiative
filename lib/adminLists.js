import {matchesSearch} from './search.js';
export const ADMIN_TAB_IDS=['issues','works','companies','professionals','universities','medicalCenters','figures','history','games','statistics','rankings','map','rates','pages','settings','messages','admins'];

export function adminList(rows,{q='',publication='all',category='all',sort='updated',page=1,size=12}={}) {
  const filtered=rows.filter(row=>matchesSearch(q,[row.name,row.name_ar,row.name_en,row.full_name,row.title,row.slug,row.summary,row.bio,row.short_bio,row.category,row.location,row.governorate,row.city,row.field,row.governorate_name,row.unit,row.domain?.name])
    && (publication==='all'||Boolean(row.is_published)===(publication==='published'))
    && (category==='all'||row.category===category));
  filtered.sort((a,b)=>sort==='title'?String(a.name||a.name_ar||a.full_name||a.title||'').localeCompare(String(b.name||b.name_ar||b.full_name||b.title||''),'ar')
    :Date.parse(b[sort==='created'?'created_at':'updated_at']||b.created_at||b.issue_date||0)-Date.parse(a[sort==='created'?'created_at':'updated_at']||a.created_at||a.issue_date||0)||String(a.id).localeCompare(String(b.id)));
  const pages=Math.max(1,Math.ceil(filtered.length/size)),current=Math.min(pages,Math.max(1,Math.trunc(Number(page))||1));
  return {items:filtered.slice((current-1)*size,current*size),total:filtered.length,page:current,pages,size};
}
