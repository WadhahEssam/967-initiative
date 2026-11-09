import {priceParts} from '@/lib/market/format';

// A price with its currency set smaller after the figure (the figure always reads left to right).
export default function Price({price,currency,className,currencyClassName}){
 const parts=priceParts(price,currency);
 if(!parts)return null;
 return <span className={className}><bdi dir="ltr">{parts.amount}</bdi>{parts.currency&&<> <small className={currencyClassName}>{parts.currency}</small></>}</span>;
}
