// Pure token rules for the editors' section preview (kept apart so node tests can import them).
// Token: <userId>.<expires in seconds>.<signature>
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sign=(userId,expires,secret,createHmac)=>createHmac('sha256','967-section-preview:'+secret).update(userId+'|'+expires).digest('base64url');

export function previewToken(userId,expiresAt,secret,{createHmac}){
 if(!secret||!UUID.test(String(userId)))return null;
 const expires=Math.floor(expiresAt/1000);
 return userId+'.'+expires+'.'+sign(userId,expires,secret,createHmac);
}

// Returns the user id when the token is genuine and not expired, else null.
export function readPreviewToken(value,now,secret,{createHmac,timingSafeEqual}){
 if(!secret||typeof value!=='string'||value.length>200)return null;
 const [userId,expires,given]=value.split('.');
 if(!UUID.test(userId||'')||!/^\d{9,11}$/.test(expires||'')||!given||Number(expires)*1000<=now)return null;
 const expected=Buffer.from(sign(userId,expires,secret,createHmac));
 const received=Buffer.from(given);
 return expected.length===received.length&&timingSafeEqual(expected,received)?userId:null;
}
