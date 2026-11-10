// Shrinks a photo on the member's phone before upload (spec: «ضغط الصور على جوال المستخدم قبل
// رفعها»): a 4 MB camera photo becomes ~300 KB, which matters on slow, paid mobile data.
// The server still re-encodes and strips metadata; this only saves the upload.
export const CLIENT_MAX_SIDE=1600;

export async function compressForUpload(file,{maxSide=CLIENT_MAX_SIDE,quality=0.85}={}){
 if(!file||!/^image\//.test(file.type)||typeof createImageBitmap!=='function')return file;
 try{
  const bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
  const scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  // Already small and light: send as it is.
  if(scale===1&&file.size<700*1024){bitmap.close?.();return file;}
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  return blob&&blob.size<file.size?new File([blob],(file.name||'photo').replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):file;
 }catch{return file;}
}
