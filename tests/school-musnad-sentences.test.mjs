import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MUSNAD_FINAL_SENTENCES,musnadSentenceIds} from '../lib/schoolMusnadSentences.js';
import {makeSchoolQuestions,publicSchoolQuestions,gradeSchoolQuestions} from '../lib/schoolMusnadQuestions.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const correct=q=>({id:q.id,choice:q.kind==='choice'?q.options.indexOf(q.answer):q.answer.map(id=>q.options.findIndex(o=>o.id===id))});

test('stage 12 uses meaningful complete Arabic sentences rather than letter names',()=>{
 assert.ok(MUSNAD_FINAL_SENTENCES.length>=12);
 assert.ok(MUSNAD_FINAL_SENTENCES.includes('اليمن دولة قديمة في التاريخ'));
 assert.equal(new Set(MUSNAD_FINAL_SENTENCES).size,MUSNAD_FINAL_SENTENCES.length);
 for(const text of MUSNAD_FINAL_SENTENCES){
  const ids=musnadSentenceIds(text);
  assert.ok(text.trim().split(' ').length>=3);
  assert.equal(ids.filter(id=>id==='sep').length,text.trim().split(' ').length-1);
  assert.ok(ids.length<=80);
 }
 assert.deepEqual(musnadSentenceIds('أهلا يا يمن'),musnadSentenceIds('اهلا يا يمن'));
 assert.deepEqual(musnadSentenceIds('مدرسة اليمن جميلة'),musnadSentenceIds('مدرسه اليمن جميله'));
});

test('stage 12 presents six full sentences with an anonymous Musnad keyboard',()=>{
 for(const attempt of [1,2,3]){
  const bank=makeSchoolQuestions(11,attempt);
  assert.equal(bank.length,6);
  assert.ok(bank.every(q=>q.kind==='sentence'&&q.target.split(' ').length>=3));
  const publicBank=publicSchoolQuestions(bank);
  for(const q of publicBank){
   assert.equal(q.options.length,30);
   assert.ok(q.options.every(option=>Object.keys(option).length===1&&typeof option.glyph==='string'));
   assert.equal(new Set(q.options.map(option=>option.glyph)).size,30);
   assert.ok(q.options.some(option=>option.glyph==='𐩽'));
   assert.ok(!Object.hasOwn(q,'answer')&&!Object.hasOwn(q,'explanation'));
  }
 }
 assert.notDeepEqual(makeSchoolQuestions(11,1).map(q=>q.target).sort(),makeSchoolQuestions(11,2).map(q=>q.target).sort());
});

test('complete sentences are server-graded with partial mistakes counted as wrong',()=>{
 const bank=makeSchoolQuestions(11,1);
 const perfect=bank.map(correct);
 assert.equal(gradeSchoolQuestions(bank,perfect).score,6);
 const incomplete=[...perfect];
 incomplete[0]={id:bank[0].id,choice:[perfect[0].choice[0]]};
 assert.equal(gradeSchoolQuestions(bank,incomplete).score,5);
 const twoWrong=[...incomplete];twoWrong[1]={id:bank[1].id,choice:[perfect[1].choice[0]]};
 assert.equal(gradeSchoolQuestions(bank,twoWrong).passed,false);
 const forged=[...perfect];forged[0]={id:bank[0].id,choice:[999]};
 assert.throws(()=>gradeSchoolQuestions(bank,forged));
});

test('full-sentence composition lives on as the card compose task and shows no Arabic hints on keys',()=>{
 // The v1 Musnad lesson was retired; composition is the card task «compose».
 const ui=read('components/school/v2/CardInteractions.jsx');
 const styles=read('components/school/v2/CardInteractions.module.css');
 assert.ok(ui.includes('compose: ComposeTask'));
 assert.ok(ui.includes('const COMPOSE_MAX = 80;'));
 assert.ok(ui.includes('disabled={locked || line.length >= COMPOSE_MAX}'));
 assert.ok(ui.includes("{(task.labels || id === 'sep') && <small>{MUSNAD_KEYS[id].name}</small>}"));
 assert.ok(styles.includes('.composeKeys{'));
 assert.ok(makeSchoolQuestions(10,1).every(q=>q.kind==='compose'));
 assert.ok(makeSchoolQuestions(2,1).every(q=>q.kind==='compose'));
});
