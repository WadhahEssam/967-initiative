import test from 'node:test';
import assert from 'node:assert/strict';
import {createProjectionReader} from '../lib/projectionReader.js';
test('optional demo-column compatibility retains required fields and rechecks schema without caching content',async()=>{
 let now=1000,rows=[{id:'real'}],calls=[];const read=createProjectionReader(()=>now);
 const query=async projection=>{calls.push(projection);if(projection.includes('is_demo'))throw Object.assign(Error('column professionals.is_demo does not exist'),{code:'42703'});return rows;};
 assert.deepEqual(await read('professionals','id,is_demo',query),rows);assert.deepEqual(calls,['id,is_demo','id']);
 rows=[{id:'new'}];assert.deepEqual(await read('professionals','id,is_demo',query),rows);assert.equal(calls.at(-1),'id');
 now+=60001;await read('professionals','id,is_demo',query);assert.equal(calls.at(-1),'id','a known-missing column is not retried after one minute');
 now+=60*60*1000;await read('professionals','id,is_demo',query);assert.deepEqual(calls.slice(-2),['id,is_demo','id']);
 const withFlag=async projection=>{assert.equal(projection,'id,is_demo');return [{id:'example',is_demo:true}];};
 assert.equal((await read('another_table','id,is_demo',withFlag))[0].is_demo,true);
 await assert.rejects(read('required','id,name',async()=>{throw Object.assign(Error('column name does not exist'),{code:'42703'});}));
 await assert.rejects(read('denied','id,is_demo',async()=>{throw Object.assign(Error('Denied'),{code:'42501'});}));
 const timelineCalls=[];await read('yemeni_figures','id,short_bio,timeline',async projection=>{timelineCalls.push(projection);if(projection.includes('timeline'))throw Object.assign(Error('column yemeni_figures.timeline does not exist'),{code:'42703'});return [{id:'figure',short_bio:'public biography'}];});
 assert.deepEqual(timelineCalls,['id,short_bio,timeline','id,short_bio']);
});
