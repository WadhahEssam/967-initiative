import 'server-only';
import {readPublicHistoryCatalog} from './historyRepository';
import {serverDb} from './supabase-server';
import {createMemo} from './serverMemo.js';
import {extractDatedFacts,factsForDay,yemenMonthDay} from './onThisDay';

// The catalog read is already cached; extracting the dates is kept 30 minutes on top of it.
const memo=createMemo({ttlMs:30*60*1000,staleMs:12*60*60*1000});
export async function onThisDay(now=new Date()){
 const facts=await memo(async()=>extractDatedFacts((await readPublicHistoryCatalog(serverDb())).entries));
 return factsForDay(facts,yemenMonthDay(now));
}
