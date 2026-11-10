import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile uses one screen for the list and one for an open conversation',()=>{
 const ui=read('components/messages/PrivateMessaging.jsx'),css=read('components/messages/PrivateMessaging.module.css');
 assert.match(ui,/data-chat-open=\{tab==='inbox'&&Boolean\(selected\)\}/);
 assert.match(ui,/className=\{styles\.backToList\} onClick=\{backToList\}/);
 assert.match(ui,/const backToList=\(\)=>\{[\s\S]{0,600}?setSelected\(null\);setThread\(null\);/);
 assert.match(css,/\.layout\[data-chat-open=true\] \.sidebar\{display:none\}/);
 assert.match(css,/\.layout\[data-chat-open=true\] \.threadArea\{display:flex;flex:1\}/);
 assert.match(css,/\.page:has\(\.layout\[data-chat-open=true\]\) \.heading\{display:none\}/);
 assert.match(css,/\.threadArea\{display:none\}/);
});

test('navigation tabs (four, and «السوق» for market members) remain usable on phones and desktop',()=>{
 const ui=read('components/messages/PrivateMessaging.jsx'),css=read('components/messages/PrivateMessaging.module.css');
 for(const tab of ['inbox','market','requests','search','settings']){
  assert.match(ui,new RegExp("aria-pressed=\\{tab==='"+tab+"'\\}"));
 }
 assert.match(ui,/\{\(market\.available\|\|tab==='market'\)&&<button/,'the market tab shows only to members who can use the market');
 assert.match(css,/\.tabs\{display:grid;grid-auto-flow:column;grid-auto-columns:minmax\(0,1fr\)/,'equal columns for four or five tabs');
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/\.tabs button\{min-height:58px/);
 assert.match(ui,/\{\(error\|\|notice\|\|loading\)\&\&<div className=\{styles\.statusArea\}/);
 assert.match(ui,/const approve=\(action,id\)=>run\(\{action,conversation:id\},async\(\)=>\{setTab\('inbox'\);await reload\(\);await open\(id\);\}\)/);
});

test('empty inbox has one useful action; profile, messages, blocks and reports remain intact',()=>{
 const ui=read('components/messages/PrivateMessaging.jsx');
 assert.match(ui,/!visible\.length&&<div className=\{styles\.emptyState\}/);
 assert.match(ui,/const saveSettings=\(\)=>run\(\{action:'settings',\.\.\.settings\}/);
 assert.match(ui,/const send=async event=>/);
 assert.match(ui,/const block=async\(account,unblock=false\)=>/);
 assert.match(ui,/onClick=\{\(\)=>setDialog\(\{type:'report',conversation:selected\}\)\}/);
 assert.match(ui,/window\.dispatchEvent\(new Event\('967:messages-changed'\)\)/);
});
