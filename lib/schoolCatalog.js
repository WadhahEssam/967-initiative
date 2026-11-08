import {MUSNAD_STAGES,musnadPublicProgress} from './schoolMusnad.js';
import {ARUD_STAGES,arudProgress} from './schoolArud.js';

// Shared public course definitions; no answer keys or learner records.
export const SCHOOL_COURSES=[
 {slug:'musnad',title:'خط المسند',category:'الكتابة والأدب',description:'تعلم حروف المسند وقراءة الكلمات وكتابة الجمل.',href:'/school/courses/musnad',stages:MUSNAD_STAGES,progress:musnadPublicProgress},
 {slug:'arud',title:'علم العروض',category:'الكتابة والأدب',description:'تعلم التفعيلات والتقطيع وأوزان البحور الستة عشر.',href:'/school/courses/arud',stages:ARUD_STAGES,progress:arudProgress}
];
export const SCHOOL_COURSE_SLUGS=SCHOOL_COURSES.map(course=>course.slug);
