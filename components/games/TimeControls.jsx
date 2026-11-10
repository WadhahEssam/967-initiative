'use client';
import {Clock3,Flame} from 'lucide-react';
import {DAILY_DURATION,PRACTICE_DURATIONS,roundDuration} from '@/lib/gameClock';
import styles from './GameTimer.module.css';
export function TimeControls({mode,seconds,onChange}){
 return <div className={styles.selector}>
  <div className={styles.caption}><Clock3 size={18}/><strong>وقت كل سؤال</strong><small>يتوقف العداد بعد الإجابة ويبدأ من جديد مع السؤال التالي.</small></div>
  {mode==='daily'?<div className={styles.fixed}><Flame size={18}/> {DAILY_DURATION} ثوانٍ — ثابتة لجميع اللاعبين</div>:
  <div role="group" aria-label="وقت الإجابة لكل سؤال" className={styles.choices}>{PRACTICE_DURATIONS.map(value=>
   <button key={value} type="button" aria-pressed={roundDuration(mode,seconds)===value} onClick={()=>onChange(value)}>{value} <span>ث</span></button>
  )}</div>}
 </div>;
}
export function GameTimer({remaining,duration,paused}){
 const seconds=Math.ceil(remaining/1000),percent=duration?Math.max(0,Math.min(100,remaining/(duration*1000)*100)):0;
 // role=timer is not announced on every tick; a single live message warns at three seconds.
 return <div role="timer" className={[styles.timer,seconds<=3&&!paused?styles.danger:''].join(' ')} aria-label={paused?'المؤقت متوقف':('الوقت المتبقي '+seconds+' ثانية')}>
  <span className="sr-only" aria-live="assertive">{!paused&&seconds===3?'بقيت ثلاث ثوانٍ':''}</span>
  <div className={styles.counter}><Clock3 size={18}/><strong dir="ltr">{String(seconds).padStart(2,'0')}</strong><span>{paused?'متوقف حتى السؤال التالي':'ثانية متبقية'}</span></div>
  <div className={styles.track} role="progressbar" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={seconds} aria-label="الوقت المتبقي"><span style={{width:percent+'%'}}/></div>
 </div>;
}
