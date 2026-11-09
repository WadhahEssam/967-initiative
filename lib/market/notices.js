// «سوق 967» in the site's notification centre (lib/unifiedNotifications.js). Two kinds:
// · stored events (market_notifications): «هل تم البيع؟», expiry, price drops, saved-search digests…
// · chats with unread messages, built from the chats themselves (like private messages), so they
//   disappear once the chat is read. Offers and reservations are messages in those chats.

const quote=value=>'«'+String(value||'إعلانك').slice(0,60)+'»';
// Arabic counted nouns: 1 رسالة · 2 رسالتان · 3–10 رسائل · 11+ رسالة.
export function countedText(count,{one,two,few,many}){
 const n=Math.max(1,Number(count)||1);
 return n===1?one:n===2?two:n<=10?n+' '+few:n+' '+many;
}

const TEXT={
 ask_sold:row=>['هل بعت '+quote(row.subject)+'؟','أجب من صفحة إعلاناتي: إن بعته يصبح «مباعًا»، وإن لم تبعه يتجدد 30 يومًا.'],
 ask_deal:row=>['هل تمت صفقة '+quote(row.subject)+'؟','مرّت 3 أيام على الحجز. أكّد البيع، أو أعد الإعلان متاحًا.'],
 expired:row=>['انتهى إعلانك '+quote(row.subject),'لم يعد يظهر في البحث. جدّده بضغطة من صفحة إعلاناتي.'],
 price_drop:row=>['انخفض سعر '+quote(row.subject),(row.detail?'السعر الجديد '+row.detail+'. ':'')+'الإعلان في مفضلتك.'],
 favourite_sold:row=>['بيع '+quote(row.subject),'الإعلان الذي حفظته في المفضلة تم بيعه. قد تجد في المفضلة إعلانًا مشابهًا متاحًا.'],
 rate_request:row=>['قيّم البائع: '+quote(row.subject),'كيف كان تعاملك؟ تقييمك يساعد غيرك على الشراء بثقة.'],
 new_rating:row=>['تقييم جديد على '+quote(row.subject),(row.detail?row.detail+' · ':'')+'يمكنك الرد عليه مرة واحدة من صفحتك في السوق.'],
 draft_reminder:row=>['أكمل إعلانك '+quote(row.subject),'مسودتك محفوظة كما تركتها. أكملها وانشرها في أقل من دقيقة.'],
 // From the team (phase 7); the full text is on /market/notices.
 listing_held:row=>['أُوقف إعلانك '+quote(row.subject)+' للمراجعة',row.detail||'يراجعه فريق السوق قبل أن يعود للظهور.'],
 listing_approved:row=>['اعتُمد إعلانك '+quote(row.subject),'إعلانك ظاهر الآن في السوق.'],
 listing_rejected:row=>['لم يُعتمد إعلانك '+quote(row.subject),row.detail||'راجع شروط السوق ثم عدّل الإعلان.'],
 listing_removed:row=>['حُذف إعلانك '+quote(row.subject)+' من السوق',row.detail||'خالف الإعلان شروط السوق.'],
 admin_message:row=>['رسالة من إدارة السوق',row.detail||''],
 market_ban:row=>['أُوقف حسابك في السوق',row.detail||''],
 saved_search:row=>[countedText(row.count,{one:'إعلان جديد يطابق بحثك',two:'إعلانان جديدان يطابقان بحثك',few:'إعلانات جديدة تطابق بحثك',many:'إعلانًا جديدًا يطابق بحثك'}),row.subject||'بحث محفوظ'],
};

export function marketNotice(row){
 const text=TEXT[row?.kind];
 if(!text)return null;
 const [title,description]=text(row);
 return {id:'market:'+row.id,source:'market',source_id:row.id,category:'market',kind:row.kind,title,description,
  href:typeof row.href==='string'&&row.href.startsWith('/')&&!row.href.startsWith('//')?row.href:'/market',created_at:row.created_at,unread:!row.read_at,read_at:row.read_at||null};
}

// A market chat with unread messages, for its member (role «buyer» or «seller»).
export function marketChatNotice(chat,listingTitle){
 const unread=Math.max(0,Math.min(100000,Number(chat?.unread)||0));
 if(!unread)return null;
 return {id:'message:market:'+chat.id,source:'message',source_id:chat.id,category:'market',kind:'market_chat',
  title:countedText(unread,{one:'رسالة جديدة',two:'رسالتان جديدتان',few:'رسائل جديدة',many:'رسالة جديدة'})+' على '+quote(listingTitle),
  description:chat.last_preview||'افتح المحادثة',href:'/messages?tab=market&chat='+encodeURIComponent(chat.id),
  created_at:chat.last_message_at,unread:true,read_at:null};
}
