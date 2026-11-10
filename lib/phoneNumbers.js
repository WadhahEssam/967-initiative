// A phone field may hold several numbers («01-577777 / 774778805»). Each becomes its own
// dialable link: the text as written, and a tel: target with only + and digits.
export function phoneNumbers(text) {
  return String(text || '').split(/\s*(?:[\/،؛,;|]|\sو\s)\s*/).map(part => part.trim()).filter(Boolean)
    .map(display => ({display, dial: display.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/(?!^\+)[^0-9]/g, '')}))
    .filter(item => item.dial.replace(/\D/g, '').length >= 5);
}
