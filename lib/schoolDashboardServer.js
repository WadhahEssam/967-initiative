import 'server-only';
import {RequestValidationError} from './requestSecurity.js';
import {SCHOOL_COURSE_SLUGS} from './schoolCatalog.js';
import {buildSchoolDashboard} from './schoolDashboard.js';
import {schoolStaffPreview} from './schoolStageAccess.js';
import {learningActivity,SCHOOL_GOALS} from './schoolLearningHabits.js';
import {schoolMistakeReview} from './schoolReview.js';
import {schoolAchievementSummary} from './schoolAchievements.js';
import {publishedSchoolCatalog,publishedSchoolStageList} from './schoolContentServer.js';

const TABLE='school_stage_attempts';
const XP_TABLE='school_xp_events';
const PAGE_SIZE=500,MAX_PAGES=20;
async function learnerHistory(db,user,slugs=SCHOOL_COURSE_SLUGS){
 const records=[];
 // Read in pages so older passes are not silently discarded after 1000 rows.
 for(let page=0;page<MAX_PAGES;page++){
  const from=page*PAGE_SIZE;
  const {data,error}=await db.from(TABLE)
   .select('course_slug,stage_index,status,created_at,submitted_at')
   .eq('user_id',user.id)
   .in('course_slug',slugs)
   .order('created_at',{ascending:false})
   .order('id',{ascending:false})
   .range(from,from+PAGE_SIZE-1);
  if(error)throw new RequestValidationError('تعذر قراءة تقدمك التعليمي.',503);
  records.push(...(data||[]));
  if((data||[]).length<PAGE_SIZE)return records;
 }
 throw new RequestValidationError('تعذر عرض سجل التعلم الكامل حاليًا.',503);
}
async function xpCredits(db,user){
 const records=[];
 for(let page=0;page<MAX_PAGES;page++){
  const from=page*PAGE_SIZE;
  const {data,error}=await db.from(XP_TABLE)
   .select('course_slug,stage_index,xp_amount')
   .eq('user_id',user.id)
   .order('id',{ascending:true})
   .range(from,from+PAGE_SIZE-1);
  if(error)throw new RequestValidationError('تعذر قراءة نقاط الخبرة الموثقة.',503);
  records.push(...(data||[]));
  if((data||[]).length<PAGE_SIZE)return records;
 }
 throw new RequestValidationError('تعذر عرض سجل نقاط الخبرة كاملًا حاليًا.',503);
}
async function learnerGoal(db,user){
 const {data,error}=await db.from('school_learning_preferences').select('daily_goal').eq('user_id',user.id).maybeSingle();
 if(error)throw new RequestValidationError('تعذر قراءة هدفك اليومي.',503);
 return data?.daily_goal||1;
}
async function gradedReview(db,user,slugs=SCHOOL_COURSE_SLUGS){
 const {data,error}=await db.from(TABLE)
  .select('course_slug,stage_index,status,questions,submission,submitted_at')
  .eq('user_id',user.id).in('course_slug',slugs)
  .in('status',['passed','failed']).order('submitted_at',{ascending:false})
  .limit(60);
 if(error)throw new RequestValidationError('تعذر قراءة تمارين المراجعة.',503);
 return schoolMistakeReview(data||[],8);
}
export async function updateSchoolGoal(db,user,goal){
 if(!db||!user?.id||!SCHOOL_GOALS.includes(goal))throw new RequestValidationError('اختر هدفًا يوميًا صالحًا.');
 const {error}=await db.from('school_learning_preferences').upsert({
  user_id:user.id,daily_goal:goal,updated_at:new Date().toISOString()
 },{onConflict:'user_id'});
 if(error)throw new RequestValidationError('تعذر حفظ الهدف اليومي.',503);
 return {dailyGoal:goal};
}
export async function schoolDashboardOverview(db,user){
 if(!db||!user?.id)throw new RequestValidationError('يرجى تسجيل الدخول.',401);
 const publishedCatalog=await publishedSchoolCatalog(db);
 const catalog=publishedCatalog.filter(c=>!SCHOOL_COURSE_SLUGS.includes(c.slug));
 // Lesson numbers and titles only: the dashboard never needs lesson content.
 const customCourses=await Promise.all(catalog.map(async c=>({...c,stages:await publishedSchoolStageList(db,c.slug)})));
 const slugs=[...SCHOOL_COURSE_SLUGS,...customCourses.map(c=>c.slug)];
 const [records,staffPreview,credits,goal,review]=await Promise.all([
  learnerHistory(db,user,slugs),schoolStaffPreview(db,user),xpCredits(db,user),learnerGoal(db,user),gradedReview(db,user,slugs)
 ]);
 return {...buildSchoolDashboard(records,staffPreview,credits,customCourses,Object.fromEntries(publishedCatalog.map(c=>[c.slug,c]))),
  habits:learningActivity(records,goal),review,achievements:schoolAchievementSummary(credits,records,slugs,Object.fromEntries(publishedCatalog.filter(c=>Number.isInteger(c.capstone)).map(c=>[c.slug,c.capstone])))};
}
