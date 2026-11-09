// Only counts of unread private messages, incoming conversation requests and unread «سوق 967»
// chat messages. Never copy message contents or account identifiers into the global header.
export function safeMessageCount(value) {
 const number = Number(value);
 return Number.isSafeInteger(number) && number>0 ? number : 0;
}
export function messageBadgeCount(summary) {
 const unread=safeMessageCount(summary?.unread);
 const requests=safeMessageCount(summary?.requests);
 const market=safeMessageCount(summary?.market);
 return Math.min(Number.MAX_SAFE_INTEGER,unread+requests+market);
}
export function messageBadgeLabel(count) {
 return count>99 ? '99+' : String(safeMessageCount(count));
}
