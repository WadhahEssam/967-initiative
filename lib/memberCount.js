import 'server-only';
import {serverDb} from './supabase-server';
import {createMemo} from './serverMemo.js';

// Registered accounts, for the footer. Auth returns the total in a header, so one row is enough.
// Kept 10 minutes; if Auth is unavailable the last number is shown for up to a day.
const memo=createMemo({ttlMs:10*60*1000,staleMs:24*60*60*1000});
export function getMemberCount(){
 return memo(async()=>{
  const db=serverDb();
  if(!db)return null;
  const {data,error}=await db.auth.admin.listUsers({page:1,perPage:1});
  if(error)throw error;
  const total=Number(data?.total);
  return Number.isSafeInteger(total)&&total>0?total:null;
 });
}
