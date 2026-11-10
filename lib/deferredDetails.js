import {createHash} from 'node:crypto';

// Long list pages send a light row per item in the HTML and fetch the rest after the page has
// painted. The details travel with a short version, so the browser can keep them until the
// content changes.
const memo=new WeakMap();
export function versionedDetails(source,build){
 let value=memo.get(source);
 if(!value){
  const details=build(source);
  value={details,version:createHash('sha1').update(JSON.stringify(details)).digest('base64url').slice(0,12)};
  memo.set(source,value);
 }
 return value;
}
export function pickDetails(details,keys){
 return Object.fromEntries([...new Set(keys)].filter(key=>key&&details[key]).map(key=>[key,details[key]]));
}
// A request for the current version may be kept for a year; any other version is answered fresh.
export function detailsResponse(value,requested){
 const current=requested===value.version;
 return Response.json({version:value.version,details:value.details},{headers:{'Cache-Control':current?'public, max-age=31536000, immutable':'no-store'}});
}
