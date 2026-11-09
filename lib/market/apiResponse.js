import 'server-only';
import {MarketActionError} from './listingsServer';
import {ListingError} from './listing.js';
import {ChatError} from './chat.js';
import {RatingError} from './ratings.js';
import {RequestValidationError} from '../requestSecurity';

// Responses of the market's member APIs: never cached, and errors in plain Arabic.
const headers={'Cache-Control':'private, no-store','Vary':'Authorization'};
export const marketJson=(body,status=200)=>Response.json(body,{status,headers});
export function marketFailure(error,fallback='تعذر إتمام الطلب. حاول مجددًا.'){
 if(error instanceof ListingError||error instanceof ChatError||error instanceof RatingError)return marketJson({error:error.message,field:error.field},400);
 if(error instanceof MarketActionError)return marketJson({error:error.message,code:error.code},error.status);
 if(error instanceof RequestValidationError)return marketJson({error:error.message},error.status);
 console.error('market request failed',error?.code||error?.status||error?.name||'unknown');
 return marketJson({error:fallback},503);
}
