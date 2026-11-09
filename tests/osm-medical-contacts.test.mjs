import test from 'node:test';
import assert from 'node:assert/strict';
import {hoursText,osmItems,phoneText} from '../scripts/osm-medical-contacts.mjs';

test('OpenStreetMap opening hours read in Arabic; unclear rules are skipped',()=>{
 assert.equal(hoursText('24/7'),'على مدار الساعة');
 assert.equal(hoursText('Mo-Su 08:00-23:00'),'يوميًا 08:00–23:00');
 assert.equal(hoursText('Sa-Th 08:00-14:00, 16:00-20:00'),'السبت–الخميس 08:00–14:00 و16:00–20:00');
 assert.equal(hoursText('Sa-We 08:00-14:00; Th 08:00-12:00; Fr off'),'السبت–الأربعاء 08:00–14:00، الخميس 08:00–12:00، الجمعة: مغلق');
 assert.equal(hoursText('Sa-Th'),null);
 assert.equal(hoursText('sunrise-sunset'),null);
});

test('facility lines are kept; a person-named clinic mobile is not',()=>{
 assert.equal(phoneText('+967 5 340188;+967 5 341608','مستشفى الحامي'),'+967 5 340188 / +967 5 341608');
 assert.equal(phoneText('01213030','مستشفى أنا وطفلي'),'01213030');
 assert.equal(phoneText('775674730','د / عيسى الجبري'),null);
 assert.equal(phoneText('773664263 - 775994994','مركز الدكتور سليم خيلة'),null);
 assert.equal(phoneText('01401670','عيادة الدكتور فلان'),'01401670','a landline stays even for a named clinic');
});

test('each item cites its OpenStreetMap object',()=>{
 const [item]=osmItems([{type:'node',id:42,tags:{name:'مستشفى',phone:'01-412345',opening_hours:'24/7',website:'www.example.org'}}]);
 assert.equal(item.slug,'osm-n42');
 assert.equal(item.website,'https://www.example.org/');
 assert.equal(item.sources[0].url,'https://www.openstreetmap.org/node/42');
 assert.equal(item.hours[0].source_url,'https://www.openstreetmap.org/node/42');
 assert.equal(osmItems([{type:'node',id:1,tags:{name:'x'}}]).length,0);
});
