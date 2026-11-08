import 'server-only';
import {getSiteSettings,getUniversities} from './data';
import {sectionIsVisible} from './pageVisibility';
import {publicDb} from './supabase';
import {serverDb} from './supabase-server';
import {getMapBoundaries,readPublicMapProfiles} from './mapProfileRepository';
import {readPublicHistoryCatalog} from './historyRepository';
import {yemenGovernorates} from './yemeniFigures';
import {createMemo} from './serverMemo.js';
import {buildGeneratedQuestions,generatedQuestionsForDay} from './generatedQuestions';

const governorateNames=Object.fromEntries(yemenGovernorates.map(item=>[item.id,item.name]));
// Built from cached sources; kept 10 minutes so a quiz visit does not rebuild ~600 questions.
const memo=createMemo({ttlMs:10*60*1000,staleMs:6*60*60*1000});

async function loadGroups(){
 const settings=await getSiteSettings(),visible=section=>sectionIsVisible(section,settings.pageVisibility);
 const atlas=visible('atlas');
 const [boundaries,profiles,history,universities]=await Promise.all([
  getMapBoundaries(),
  atlas?readPublicMapProfiles(publicDb()).catch(()=>({})):Promise.resolve({}),
  visible('history')?readPublicHistoryCatalog(serverDb()).then(result=>result.entries).catch(()=>[]):Promise.resolve([]),
  getUniversities().catch(()=>[]),
 ]);
 const groups=buildGeneratedQuestions({boundaries,profiles,governorateNames,history,universities});
 // Atlas questions link to atlas pages; drop them when that section is hidden.
 if(!atlas){groups.district=[];groups.capital=[];groups.superlative=[];}
 return groups;
}

// Practice-only questions for one UTC day. They never enter the official daily challenge.
export async function generatedPracticeQuestions(date){
 const groups=await memo(loadGroups);
 return generatedQuestionsForDay(groups,date);
}
