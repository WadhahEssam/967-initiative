// «سوق 967» seller ratings: the criteria and rules from the spec, kept pure for the server, the
// browser and the tests.
import {cleanText} from './text.js';

export const RATING_CRITERIA=[
 {key:'accuracy',label:'مطابقة الوصف',hint:'هل المنتج كما في الإعلان والصور؟'},
 {key:'price',label:'الالتزام بالسعر',hint:'هل التزم بالسعر المتفق عليه دون تغيير مفاجئ؟'},
 {key:'punctuality',label:'الالتزام بالموعد',hint:'هل حضر أو سلّم في الوقت المتفق عليه؟'},
 {key:'manners',label:'حسن التعامل',hint:'الاحترام ووضوح التواصل.'},
];
// The average shows only after this many ratings, so one rating cannot define a seller.
export const MIN_RATINGS_SHOWN=3;
export const RATING_DAYS_AFTER_CHAT=3;
export const RATING_TEXT_MAX=600;

export class RatingError extends Error{
 constructor(message,field=null){super(message);this.name='RatingError';this.field=field;}
}

export function validateRating(input={}){
 const out={};
 for(const {key,label} of RATING_CRITERIA){
  const value=Number(input[key]);
  if(!Number.isInteger(value)||value<1||value>5)throw new RatingError('اختر من 1 إلى 5 نجوم لـ«'+label+'».',key);
  out[key]=value;
 }
 out.comment=cleanText(input.comment,RATING_TEXT_MAX);
 return out;
}
export const ratingOverall=rating=>Math.round(RATING_CRITERIA.reduce((sum,{key})=>sum+Number(rating[key]||0),0)/RATING_CRITERIA.length*10)/10;

// Why a buyer cannot rate yet, or null when they can. Only someone who chatted with the seller and
// got a reply; after the sale or three days after the chat began; once per listing.
export function ratingBlocker({role,listingStatus,chatCreatedAt,sellerReplied,buyerWrote,alreadyRated,sellerGone},now=Date.now()){
 if(role!=='buyer')return 'التقييم للمشتري الذي تواصل مع البائع.';
 if(sellerGone)return 'لم يعد حساب البائع متاحًا.';
 if(alreadyRated)return 'قيّمت هذا البائع على هذا الإعلان من قبل.';
 if(!buyerWrote||!sellerReplied)return 'يُفتح التقييم بعد أن يرد البائع على رسائلك.';
 const opens=Date.parse(chatCreatedAt)+RATING_DAYS_AFTER_CHAT*86400000;
 if(listingStatus!=='sold'&&!(opens<=now))return 'يُفتح التقييم بعد بيع الإعلان، أو بعد 3 أيام من بدء المحادثة.';
 return null;
}

// «4.6» with «12 تقييمًا», or why there is no average yet.
export function ratingSummary(stats){
 const count=Number(stats?.ratings)||0;
 if(!count)return {shown:false,text:'لا توجد تقييمات بعد'};
 if(count<MIN_RATINGS_SHOWN)return {shown:false,text:count===1?'تقييم واحد حتى الآن':'تقييمان حتى الآن'};
 const label=count<=10?count+' تقييمات':count+' تقييمًا';
 return {shown:true,value:Number(stats.overall),text:Number(stats.overall).toFixed(1)+' من 5 · '+label};
}

// «يرد خلال ساعة عادةً»: from the median time to the first answer (chats of the last 90 days).
// Shown only with a few chats behind it.
export function responseText(stats){
 const chats=Number(stats?.chats)||0,answered=Number(stats?.answered)||0;
 if(chats<3)return null;
 const rate=Math.round(answered/chats*100);
 const hours=Number(stats.response_hours);
 const speed=!answered||!Number.isFinite(hours)?'نادرًا ما يرد':hours<=1?'يرد خلال ساعة عادةً':hours<=6?'يرد خلال ساعات عادةً':hours<=24?'يرد خلال يوم عادةً':'قد يتأخر في الرد';
 return speed+' · يرد على '+rate+'% من الرسائل';
}

export const starsText=value=>'★'.repeat(Math.round(Number(value)||0))+'☆'.repeat(5-Math.round(Number(value)||0));
