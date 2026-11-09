import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceMessageAlert,playMessageChime} from '../lib/messageSound.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const oldest='2026-11-03T12:30:00.000Z';
const newest='2026-11-03T12:31:00.000Z';
const base={notify_messages:true,latest_incoming_unread_at:oldest};

test('incoming message sound only on a newer incoming unread message outside the chat',()=>{
 const initial=advanceMessageAlert(null,base,'/knowledge');
 assert.equal(initial.play,false,'never chime on initial load with old unread messages');
 const same=advanceMessageAlert(initial.state,base,'/knowledge');
 assert.equal(same.play,false,'never repeat sound for the same message');
 const later=advanceMessageAlert(same.state,{...base,latest_incoming_unread_at:newest},'/knowledge');
 assert.equal(later.play,true);
 const repeated=advanceMessageAlert(later.state,{...base,latest_incoming_unread_at:newest},'/knowledge');
 assert.equal(repeated.play,false);
 const read=advanceMessageAlert(repeated.state,{...base,latest_incoming_unread_at:null},'/knowledge');
 assert.equal(read.play,false);
 const resurfaced=advanceMessageAlert(read.state,base,'/knowledge');
 assert.equal(resurfaced.play,false,'reading a newer thread must not replay an older one');
});

test('audio respects privacy setting and never sounds on any messages route',()=>{
 const initial=advanceMessageAlert(null,{notify_messages:true,latest_incoming_unread_at:null},'/');
 for(const path of ['/messages','/messages/123']){
  assert.equal(advanceMessageAlert(initial.state,{notify_messages:true,latest_incoming_unread_at:newest},path).play,false);
 }
 const muted=advanceMessageAlert(initial.state,{notify_messages:false,latest_incoming_unread_at:newest},'/');
 assert.equal(muted.play,false);
 assert.equal(advanceMessageAlert(muted.state,{notify_messages:true,latest_incoming_unread_at:newest},'/').play,false);
 assert.equal(advanceMessageAlert(muted.state,{notify_messages:true,latest_incoming_unread_at:'2026-11-03T12:32:00.000Z'},'/').play,true);
});

test('two-note chime uses a previously unlocked browser audio context',()=>{
 assert.equal(playMessageChime(null),false);
 assert.equal(playMessageChime({state:'suspended'}),false);
 const frequencies=[];
 const context={
  state:'running',currentTime:2,
  destination:{},
  createOscillator:()=>({type:'',frequency:{setValueAtTime:(f)=>frequencies.push(f)},
   connect:()=>{},start:()=>{},stop:()=>{}}),
  createGain:()=>({gain:{setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},connect:()=>{}})
 };
 assert.equal(playMessageChime(context),true);
 assert.deepEqual(frequencies,[660,880]);
});

test('the existing shared header summary sends only counts, settings, and the latest unread timestamp',()=>{
 const header=read('components/Header.jsx');
 const api=read('app/api/messages/route.js');
 const ui=read('components/messages/PrivateMessaging.jsx');
 assert.match(header,/advanceMessageAlert\(messageAlertRef\.current,result,pathRef\.current\)/);
 assert.match(header,/playMessageChime\(messageAudioRef\.current\)/);
 assert.match(header,/window\.addEventListener\('pointerdown',unlock/);
 assert.match(header,/window\.setInterval\(refresh,60000\)/);
 assert.match(header,/document\.visibilityState !== 'visible'/);
 assert.match(api,/\.neq\('sender_id',user\.id\)/);
 assert.match(api,/latest_incoming_unread_at/);
 assert.match(api,/\.select\('notify_messages'\)/);
 assert.doesNotMatch(api,/latest_incoming_unread_at:.*body/);
 assert.match(ui,/تنبيه صوتي عند وصول رسالة/);
});
