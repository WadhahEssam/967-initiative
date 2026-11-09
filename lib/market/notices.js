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
