// Arabic text helpers for «سوق 967» search: one spelling for the many ways a word is typed.

// Arabic-Indic (U+0660–0669) and Persian (U+06F0–06F9) digits to 0–9.
export const westernDigits=value=>String(value??'').replace(/[٠-٩۰-۹]/g,digit=>String(digit.charCodeAt(0)&0xF));

// أ/إ/آ → ا، ة → ه، ى → ي، no diacritics or tatweel, Western digits, lower-case Latin, single spaces.
export function normalizeSearch(value){
 return westernDigits(value).replace(/[ً-ْٰـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ؤ/g,'و').replace(/ئ/g,'ي')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

// Free text a seller types: trimmed, single spaces, no control characters, at most `max` characters.
export function cleanText(value,max){
 return String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim().slice(0,max);
}
