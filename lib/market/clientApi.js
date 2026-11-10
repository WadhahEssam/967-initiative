'use client';
import {currentSession} from '../browserSession';

// The signed-in member's session, or null. The account client loads only when a session may exist.
export const marketSession=currentSession;

// Requests to the market APIs with the member's session token (the site authenticates API calls
// with Bearer tokens). Errors carry the server's Arabic message, status, code and field.
export async function marketApi(path,{method='GET',body,form,signInMessage='سجّل الدخول أولًا.'}={}){
 const session=await marketSession();
 if(!session)throw Object.assign(new Error(signInMessage),{status:401});
 const response=await fetch(path,{method,cache:'no-store',headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},body:form||(body?JSON.stringify(body):undefined)});
 const result=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(result.error||'تعذر إتمام الطلب.'),{status:response.status,code:result.code,field:result.field});
 return result;
}

// Where to send a visitor to sign in and come back.
export const loginHref=()=>'/login?next='+encodeURIComponent(location.pathname+location.search);
