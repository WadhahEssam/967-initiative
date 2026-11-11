// Duplicate photos in «سوق 967»: a 64-bit difference hash (dHash) of each uploaded picture.
// The picture is reduced to 9×8 grey pixels; each bit says whether a pixel is brighter than its
// right-hand neighbour. Resizing, recompression and small edits keep the hash within a few bits,
// so two listings using the same photo are found by the number of differing bits (see the SQL
// function market_photo_matches). Pure functions: sharp produces the pixels in images.js.

export const HASH_SIZE={width:9,height:8};
// Nearly flat pictures (a blank wall, a white background) give almost no bits and would match each
// other; they are not hashed.
const MIN_BITS=6,MAX_BITS=58;

// pixels: 72 grey values (row by row, 9 per row). Returns 16 hex characters, or null.
export function dhashFromPixels(pixels){
 if(!pixels||pixels.length!==HASH_SIZE.width*HASH_SIZE.height)return null;
 let hash=0n,bits=0;
 for(let row=0;row<HASH_SIZE.height;row++)
  for(let col=0;col<HASH_SIZE.width-1;col++){
   const left=pixels[row*HASH_SIZE.width+col],right=pixels[row*HASH_SIZE.width+col+1];
   hash<<=1n;
   if(left>right){hash|=1n;bits++;}
  }
 if(bits<MIN_BITS||bits>MAX_BITS)return null;
 return hash.toString(16).padStart(16,'0');
}

// Number of differing bits between two hashes (0–64), or null when either is missing.
export function hashDistance(a,b){
 if(!/^[0-9a-f]{16}$/.test(a||'')||!/^[0-9a-f]{16}$/.test(b||''))return null;
 let x=BigInt('0x'+a)^BigInt('0x'+b),n=0;
 while(x){n+=Number(x&1n);x>>=1n;}
 return n;
}

// The review note shown to the team for a listing held because of a matching photo.
export const photoMatchReason=numbers=>'صورة مطابقة لصورة في إعلان بائع آخر ('+numbers.map(n=>'#'+n).join('، ')+')';
