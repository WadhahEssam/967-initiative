import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {createTimedFetch} from './requestSecurity.js';

// This feature never uses the service role: RLS also applies behind the API.
export function taskRequestDb(request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key)return null;
 const authorization=request.headers.get('authorization')||'';
 return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},db:{retry:false},global:{headers:{Authorization:authorization},fetch:createTimedFetch(15000)}});
}
