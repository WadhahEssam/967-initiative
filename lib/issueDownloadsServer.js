import 'server-only';
import {serverDb} from './supabase-server';

// Download counts by issue id. Missing table or a read error just means no counts are shown.
export async function readIssueDownloads(ids=[]){
 const db=serverDb(),wanted=ids.filter(Boolean);
 if(!db||!wanted.length)return new Map();
 const {data,error}=await db.from('issue_download_counts').select('issue_id,downloads').in('issue_id',wanted);
 if(error)return new Map();
 return new Map((data||[]).map(row=>[row.issue_id,Number(row.downloads)||0]));
}
