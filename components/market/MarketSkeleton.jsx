import ui from './ui.module.css';
import styles from './Skeleton.module.css';

// What a market screen looks like while the server answers (loading.jsx), so a tap always shows
// something at once on a slow connection. Shapes match the real screens to avoid a jump.
export function GridSkeleton({bar=true}){
 return <div className={styles.page} aria-busy="true" aria-label="جارٍ التحميل">
  {bar&&<div className={`${ui.skeleton} ${styles.bar}`}/>}
  <div className={styles.head}><span className={`${ui.skeleton} ${styles.line}`}/><span className={`${ui.skeleton} ${styles.pill}`}/></div>
  <div className={styles.grid}>{Array.from({length:6},(_,i)=><div key={i}><div className={`${ui.skeleton} ${styles.photo}`}/><span className={`${ui.skeleton} ${styles.short}`}/><span className={`${ui.skeleton} ${styles.line}`}/></div>)}</div>
 </div>;
}
export function ListingSkeleton(){
 return <div className={styles.listing} aria-busy="true" aria-label="جارٍ التحميل">
  <div className={`${ui.skeleton} ${styles.gallery}`}/>
  <div className={styles.body}>
   <span className={`${ui.skeleton} ${styles.price}`}/>
   <span className={`${ui.skeleton} ${styles.line}`}/>
   <span className={`${ui.skeleton} ${styles.short}`}/>
   <div className={`${ui.skeleton} ${styles.card}`}/>
  </div>
 </div>;
}
