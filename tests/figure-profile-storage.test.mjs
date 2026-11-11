import test from 'node:test';
import assert from 'node:assert/strict';
import {createFigureProfileCache,readFigureProfile} from '../lib/figureProfileRepository.js';
import {emptyFigureProfile} from '../lib/figureProfiles.js';

// 2026-11-11: right after a deploy, a crawl of the figure pages got 72 errors (500). Supabase Storage
// refused some profile downloads («429 Too many connections issued to the database»), and the page
// threw. Downloads are now limited, retried when the refusal is temporary, and the page falls back.
const record={id:'0b7c4c8e-3c1a-4d5e-9f00-123456789abc',updated_at:'2026-11-01T10:00:00Z'};
const profileBlob=()=>new Blob([JSON.stringify(emptyFigureProfile())]);
function storage(results){
 let calls=0;
 return {calls:()=>calls,db:{storage:{from:()=>({download:async()=>{const r=results[Math.min(calls,results.length-1)];calls++;return r;}})}}};
}
const refused={data:null,error:{status:429,message:'Too many connections issued to the database'}};

test('a temporary Storage refusal is retried; a missing file is not',async()=>{
 const busy=storage([refused,refused,{data:profileBlob(),error:null}]);
 const value=await readFigureProfile(busy.db,record,{wait:async()=>{}});
 assert.ok(value);
 assert.equal(busy.calls(),3);

 const missing=storage([{data:null,error:{status:404,message:'Object not found'}}]);
 assert.equal(await readFigureProfile(missing.db,record,{wait:async()=>{}}),null);
 assert.equal(missing.calls(),1);

 const down=storage([refused]);
 await assert.rejects(readFigureProfile(down.db,record,{wait:async()=>{}}));
 assert.equal(down.calls(),3);
});

test('at most two downloads run together, one per profile, and failures are not cached',async()=>{
 let running=0,peak=0,reads=0,fail=true;
 const read=async(_db,r)=>{reads++;running++;peak=Math.max(peak,running);await new Promise(resolve=>setTimeout(resolve,5));running--;if(r.id.endsWith('f')&&fail)throw new Error('busy');return {id:r.id};};
 const cached=createFigureProfileCache({read});
 const ids=['a','b','c','d','e'].map(ch=>({id:'0b7c4c8e-3c1a-4d5e-9f00-12345678900'+ch,updated_at:'2026-11-01T10:00:00Z'}));
 await Promise.all([...ids,...ids].map(r=>cached(null,r)));
 assert.equal(peak,2);
 assert.equal(reads,5);
 const flaky={id:'0b7c4c8e-3c1a-4d5e-9f00-12345678900f',updated_at:'2026-11-01T10:00:00Z'};
 await assert.rejects(cached(null,flaky));
 fail=false;
 assert.deepEqual(await cached(null,flaky),{id:flaky.id});
});
