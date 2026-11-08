import {gradeSchoolQuestions,publicSchoolQuestions} from './schoolMusnadQuestions.js';
import {gradeArudQuestions,publicArudQuestions} from './schoolArudQuestions.js';
import {gradeSchoolChoice,publicSchoolChoice} from './schoolContent.js';
const graders={musnad:[gradeSchoolQuestions,publicSchoolQuestions],arud:[gradeArudQuestions,publicArudQuestions]};
export function schoolMistakeReview(records=[],limit=8){
 const reviewed=new Set(),mistakes=[];
 for(const row of records){
  if(mistakes.length>=limit)break;
  if(!['passed','failed'].includes(row.status)||(typeof row.course_slug!=='string'||!/^[a-z][a-z0-9-]{2,39}$/.test(row.course_slug))||!Number.isInteger(row.stage_index)||row.stage_index<0||row.stage_index>11)continue;
  // Card lessons (format 2) get their own review in phase 5; skip them here.
  if(Array.isArray(row.questions)&&row.questions[0]?.format===2)continue;
  try{
   const [grade,publish]=graders[row.course_slug]||[gradeSchoolChoice,publicSchoolChoice];
   const graded=grade(row.questions,row.submission).review;
   const publicQuestions=publish(row.questions);
   for(let i=0;i<graded.length;i++){
    const r=graded[i],key=row.course_slug+':'+row.stage_index+':'+r.id;
    if(reviewed.has(key))continue;
    reviewed.add(key);
    if(r.correct)continue;
    mistakes.push({id:key,course:row.course_slug,stage:row.stage_index,prompt:publicQuestions[i].prompt,
     context:publicQuestions[i].target||publicQuestions[i].glyph||null,answer:r.answer,explanation:r.explanation,
     href:'/school/courses/'+row.course_slug+'/'+(row.stage_index+1)});
    if(mistakes.length>=limit)break;
   }
  }catch{/* Skip malformed historic attempts; never review active attempts. */}
 }
 return mistakes;
}
