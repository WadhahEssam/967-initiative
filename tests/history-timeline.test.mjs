import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chronologicalHistory,boundedTimelineIndex,timelineAdjacentIndex} from '../lib/historyTimeline.js';
import {historyStarter} from '../lib/yemenHistory.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('timeline sorts chronologically across overlapping eras without mutating records',()=>{
 const original=[{year:1962,slug:'a',title:'أ'},{year:-500,slug:'b',title:'ب'},{year:630,slug:'c',title:'ج'}];
 const ordered=chronologicalHistory(original);
 assert.deepEqual(ordered.map(x=>x.year),[-500,630,1962]);
 assert.equal(original[0].year,1962);
 assert.deepEqual(chronologicalHistory([]),[]);
 const all=chronologicalHistory(historyStarter);
 assert.equal(all[0].year,Math.min(...historyStarter.map(entry=>entry.year)));
 assert.ok(all.every((entry,index)=>index===0||all[index-1].year<=entry.year));
});

test('scrubber and next/previous navigation clamp to valid event indexes',()=>{
 assert.equal(boundedTimelineIndex(-20,31),0);
 assert.equal(boundedTimelineIndex(400,31),30);
 assert.equal(boundedTimelineIndex(8.6,31),9);
 assert.equal(boundedTimelineIndex(Number.NaN,31),0);
 assert.equal(boundedTimelineIndex(9,0),0);
 assert.equal(timelineAdjacentIndex(30,1,31),30);
 assert.equal(timelineAdjacentIndex(0,-1,31),0);
 assert.equal(timelineAdjacentIndex(4,1,31),5);
});

test('actual horizontal milestone track is default, accessible and does not remove card alternative',()=>{
 const explorer=read('components/history/HistoryExplorer.jsx');
 const timeline=read('components/history/HistoryTimeline.jsx');
 const styling=read('components/history/HistoryTimeline.module.css');
 assert.ok(explorer.includes("useState('timeline')"));
 assert.ok(explorer.includes("<HistoryTimeline entries={selected} detailsStatus={status} onRetry={load}/>"));
 assert.ok(explorer.includes("mode==='cards'"));
 assert.ok(timeline.includes('type="range"'));
 assert.ok(timeline.includes('aria-pressed={active}'));
 assert.ok(timeline.includes('scrollIntoView'));
 assert.ok(timeline.includes('aria-live="polite"'));
 assert.ok(timeline.includes('historyEntryPath(selected.slug)'));
 assert.ok(timeline.includes('chronologicalHistory(entries)'));
 assert.ok(timeline.includes('التواريخ القديمة تقريبية'));
 assert.ok(styling.includes('overflow-x:auto'));
 assert.ok(styling.includes('scroll-snap-type:x'));
 assert.ok(styling.includes('@media(max-width:600px)'));
 assert.ok(styling.includes('prefers-reduced-motion:reduce'));
});
