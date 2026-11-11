'use client';
import {useEffect,useState} from 'react';
import Link from '@/components/SiteLink';
import {googleRedirectTo,googleSignInEnabled,rememberGoogleTerms} from '@/lib/googleAuth';
import styles from './GoogleSignIn.module.css';

// Google's «G» mark, in its own colours (Google's sign-in branding asks for the original mark).
function GoogleMark(){
 return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
  <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
 </svg>;
}

// «المتابعة بحساب Google»: shown only when Supabase reports Google as enabled.
export default function GoogleSignIn({db,next,termsAvailable=true,onError}){
 const [enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;googleSignInEnabled().then(value=>{if(live)setEnabled(value);});return()=>{live=false;};},[]);
 if(!enabled||!db)return null;
 async function start(){
  if(busy)return;setBusy(true);
  rememberGoogleTerms();
  const {error}=await db.auth.signInWithOAuth({provider:'google',options:{redirectTo:googleRedirectTo(location.origin,next),queryParams:{prompt:'select_account'}}});
  // On success the browser is already on its way to Google.
  if(error){setBusy(false);onError?.('تعذر بدء الدخول بحساب Google. حاول مجددًا أو استخدم البريد الإلكتروني.');}
 }
 return <div className={styles.google}>
  <button type="button" className={styles.button} onClick={start} disabled={busy||!termsAvailable}><GoogleMark/>{busy?'جارٍ التحويل إلى Google…':'المتابعة بحساب Google'}</button>
  {termsAvailable&&<p className={styles.note}>بالمتابعة بحساب Google توافق على <Link href="/terms" target="_blank">شروط الاستخدام</Link> و<Link href="/privacy" target="_blank">سياسة الخصوصية</Link>. إن لم يكن لك حساب سيُنشأ باسمك في Google، ويمكنك تغييره من «حسابي».</p>}
  <p className={styles.divider} aria-hidden="true"><span>أو بالبريد الإلكتروني</span></p>
 </div>;
}
