// Optional columns differ between older installations. Only the schema hint is
// cached, never content or publication decisions. It lasts an hour: with a
// one-minute hint, every visit after a minute repeated a failing request (HTTP 400)
// against Supabase. A deploy restarts the process, so a new column is picked up then.
export function createProjectionReader(clock=Date.now,hintMs=60*60*1000){
 const absent=new Map();
 const optional={yemeni_companies:['is_demo'],professionals:['is_demo'],yemeni_figures:['timeline']};
 return async function readProjection(table,projection,read){
  if(projection==='*')return read(projection);
  const hint=absent.get(table),fields=projection.split(',');
  const activeHint=hint&&clock()-hint.at<hintMs;
  const selected=activeHint?fields.filter(field=>field!==hint.field).join(','):projection;
  try{return await read(selected);}catch(error){
   const missing=(optional[table]||[]).find(field=>fields.includes(field)&&new RegExp('\\b'+field+'\\b').test(error.message||''));
   if(selected===projection&&missing&&error.code==='42703'){
    absent.set(table,{at:clock(),field:missing});return read(fields.filter(field=>field!==missing).join(','));
   }
   throw error;
  }
 };
}
