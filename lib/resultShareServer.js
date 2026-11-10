import 'server-only';
import {gameTypes} from './arcadeChallenges';
import {extraGameTypes} from './extraGames';
import {serverDb} from './supabase-server';
import {publishedSchoolCatalog,publishedSchoolStageList} from './schoolContentServer';
import {shareAccents} from './shareCard';
import {guestLessonOpen} from './schoolGuest';

// Turns a parsed result link (lib/resultShare) into the texts of its page and its image.
// Names come from the site's own catalogues; the numbers are shown as a challenge.
const gameNames={quiz:'اختبار معرفتي باليمن',...Object.fromEntries(Object.entries({...gameTypes,...extraGameTypes}).map(([id,value])=>[id,value.title]))};
const gamesAccent='#a35a12';

export async function describeResult(result){
 if(!result)return null;
 if(result.kind==='game'){
  const name=gameNames[result.game];
  if(!name)return null;
  return {
   kicker:'ألعاب 967',accent:gamesAccent,
   title:`حقق ${result.score} من ${result.total} في «${name}»`,
   subtitle:result.daily?'تحدي اليوم':'جولة حرة',
   description:'هل تتفوق على هذه النتيجة؟ العب مجانًا على 967ye.com',
   art:{type:'big',text:`${result.score}/${result.total}`,label:'إجابات صحيحة'},
   // The visitor tries the same game in free play (no account needed); the daily challenge itself
   // needs an account and is offered from the game page.
   cta:{href:'/games/'+result.game,label:'العب الآن'},
   challenge:'هل تتفوق على هذه النتيجة؟ الجولة الحرة مجانية ولا تحتاج حسابًا.',
   more:{href:'/games',label:'كل ألعاب 967'},
  };
 }
 const db=serverDb();
 if(!db)return null;
 const [catalog,lessons]=await Promise.all([publishedSchoolCatalog(db).catch(()=>[]),publishedSchoolStageList(db,result.course).catch(()=>[])]);
 const course=catalog.find(item=>item.slug===result.course),lesson=lessons.find(item=>item.index===result.lesson-1);
 if(!course||!lesson)return null;
 return {
  kicker:'مدرسة 967',accent:shareAccents.school,
  title:`أنهى درس «${lesson.title}»`,
  subtitle:course.title,
  description:'دروس قصيرة وتفاعلية عن اليمن والعالم. ابدأ مجانًا على 967ye.com',
  art:{type:'big',text:`${result.stars}/3`,label:'نجوم'},
  // Lessons after the first few need an account: send visitors to the course's open lessons then.
  ...(guestLessonOpen(result.lesson-1)
   ?{cta:{href:'/school/courses/'+result.course+'/'+result.lesson,label:'جرّب هذا الدرس'},challenge:'الدرس قصير وتفاعلي، ويمكنك تجربته دون حساب.'}
   :{cta:{href:'/school/courses/'+result.course,label:'ابدأ المسار'},challenge:'أول ثلاثة دروس من المسار مفتوحة دون حساب، وهذا الدرس من بقيته.'}),
  more:{href:'/school/courses/'+result.course,label:'مسار «'+course.title+'»'},
 };
}
