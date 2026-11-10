// Stands in for an entry's summary until /api/history/details has arrived.
export default function HistoryPending({status,onRetry,className}){
 return <p className={className} role="status" style={{opacity:.75}}>{status==='failed'?<>تعذر تحميل الملخص. <button type="button" onClick={onRetry} style={{textDecoration:'underline'}}>أعد المحاولة</button></>:'جارٍ تحميل الملخص…'}</p>;
}
