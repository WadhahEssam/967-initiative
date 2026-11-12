'use client';
import {useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowUp,Beef,Flame,Search,ShoppingBasket,Soup,Wheat,Carrot,Droplets} from 'lucide-react';
import {formatNumber} from '@/lib/format';
import {PriceSheet} from './PriceReport';
import styles from './Services.module.css';

const GROUP_ICONS={grains:Wheat,legumes:Soup,pantry:Droplets,produce:Carrot,protein:Beef,energy:Flame};
const normalize=value=>String(value||'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase();
const money=value=>formatNumber(value,{maximumFractionDigits:value<100?2:0});
const dollars=value=>formatNumber(value,{maximumFractionDigits:value<10?2:1});

function Cell({cell,mode,cheaper,onPick,label}){
 if(!cell)return <td className={styles.foodEmpty}>{onPick?<button type="button" className={styles.cellButton} onClick={onPick} aria-label={'لا يوجد سعر حديث لـ'+label+'. أبلغ عن السعر'}>—</button>:<span aria-label="لا يوجد سعر حديث">—</span>}</td>;
 const inUsd=mode==='usd'&&cell.usd!==null;
 const percent=cell.change===null?0:Math.round(cell.change*100);
 const Icon=percent>0?ArrowUp:ArrowDown;
 const content=<>
  <span className={styles.foodPrice}>{inUsd?'$'+dollars(cell.usd):money(cell.price)}</span>
  {percent!==0&&<small className={percent>0?styles.up:styles.down} title="مقارنة بالقراءة السابقة"><Icon size={12} aria-hidden="true"/>{Math.abs(percent)}%<span className="sr-only">{percent>0?' ارتفاع':' انخفاض'} عن القراءة السابقة</span></small>}
  {cheaper&&<small className={styles.cheaper}>أرخص</small>}
  {inUsd?<small>{money(cell.price)} ريال</small>:cell.per&&<small>{cell.per.unit} {money(cell.per.value)}</small>}
  {!inUsd&&cell.usd!==null&&<small>≈ ${dollars(cell.usd)}</small>}
  {cell.stale&&<small className={styles.foodStale}>{cell.ago}</small>}
 </>;
 // With reporting on, the whole price opens its sheet (confirm it or report a different one).
 return <td data-stale={cell.stale||undefined}>{onPick?<button type="button" className={styles.cellButton} onClick={onPick} aria-label={label+': '+money(cell.price)+' ريال. تأكيد السعر أو الإبلاغ عن سعر مختلف'}>{content}</button>:content}</td>;
}

// The sheet for one item in one city: the price, what it rests on, then the two actions.
function ItemSheet({pick,onClose}){
 const cell=pick?.cell;
 const details=pick&&<div className={styles.sheetPrice}>
  <span className={styles.headlineLabel}>{pick.name} · {pick.unit}</span>
  {cell?<p className={styles.bigFigure}><strong>{money(cell.price)}</strong> <span>ريال</span></p>:<p>لا يوجد سعر حديث في {pick.regionName}.</p>}
  {cell?.basis&&<p className={styles.community}>{cell.confidenceLabel&&<span className={styles.confidence} data-level={cell.confidence}>{cell.confidenceLabel}</span>}<span>{cell.basis}</span>{cell.range&&<span>{cell.range}</span>}</p>}
 </div>;
 return <PriceSheet open={Boolean(pick)} onClose={onClose} kind="food" region={pick?.region} item={pick?.item} title={pick?pick.name+' في '+pick.regionName:''} details={details} start={cell?'choose':'report'}/>;
}

// The staple prices table with what readers do with it: find an item, compare the two cities in
// dollars (the rial differs between them), and jump between groups.
export default function FoodBoard({groups,regions,rows,canUseDollars,reporting=false}){
 const [query,setQuery]=useState('');
 const [pick,setPick]=useState(null);
 const [mode,setMode]=useState('yer');
 const tools=useRef(null);
 // Lands the group just below the sticky toolbar, whatever height it has on this screen.
 const jump=(event,id)=>{
  const target=document.getElementById(id);
  if(!target||!tools.current)return;
  event.preventDefault();
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top:window.scrollY+target.getBoundingClientRect().top-tools.current.getBoundingClientRect().height-Number.parseFloat(getComputedStyle(tools.current).top||'0')-8,behavior:reduce?'auto':'smooth'});
  history.replaceState(null,'','#'+id);
 };
 const shown=useMemo(()=>{const q=normalize(query).trim();return q?rows.filter(row=>normalize(row.name+' '+row.unit).includes(q)):rows;},[rows,query]);
 const visibleGroups=groups.filter(group=>shown.some(row=>row.group===group.id));
 return <section className={styles.foodBoard} aria-labelledby="food-table-title">
  <h2 id="food-table-title" className="sr-only">جدول الأسعار</h2>
  <div className={styles.foodTools} ref={tools}>
   <label className={styles.foodSearch}><Search size={17} aria-hidden="true"/><span className="sr-only">ابحث عن مادة</span><input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="ابحث: أرز، غاز، بيض…" autoComplete="off"/></label>
   {canUseDollars&&<div className={styles.choice} role="group" aria-label="عرض الأسعار">
    <button type="button" aria-pressed={mode==='yer'} onClick={()=>setMode('yer')}>بالريال</button>
    <button type="button" aria-pressed={mode==='usd'} onClick={()=>setMode('usd')}>بالدولار</button>
   </div>}
   <nav className={styles.jump} aria-label="المجموعات">{groups.map(group=>{const Icon=GROUP_ICONS[group.id]||ShoppingBasket;return <a key={group.id} href={'#food-'+group.id} onClick={event=>jump(event,'food-'+group.id)} aria-disabled={!visibleGroups.includes(group)||undefined}><Icon size={15} aria-hidden="true"/>{group.name}</a>;})}</nav>
  </div>
  {reporting&&<p className={styles.tapHint}>اضغط على أي سعر لتأكيده أو للإبلاغ عن سعر مختلف في مدينتك.</p>}
  {mode==='usd'&&<p className={styles.modeNote}>الأسعار محوّلة إلى الدولار بسعر صرف اليوم في كل مدينة، لتُقارن مباشرة. «أرخص» تعني أن الفرق بين المدينتين أكثر من 5%.</p>}
  {visibleGroups.length?<div className={styles.foodGroups}>{visibleGroups.map(group=>{const Icon=GROUP_ICONS[group.id]||ShoppingBasket;return <section key={group.id} id={'food-'+group.id} className={styles.foodCard} aria-labelledby={'food-title-'+group.id}>
   <h3 id={'food-title-'+group.id}><span className={styles.groupIcon}><Icon size={18} aria-hidden="true"/></span>{group.name}</h3>
   <table className={styles.food}>
    <thead><tr><th scope="col">المادة</th>{regions.map(region=><th key={region.id} scope="col">{region.name}</th>)}</tr></thead>
    <tbody>{shown.filter(row=>row.group===group.id).map(row=>{
     const usd=regions.map(region=>row.cells[region.id]?.usd).filter(value=>value!=null);
     const low=mode==='usd'&&usd.length===2&&Math.abs(usd[0]-usd[1])/Math.max(...usd)>0.05?Math.min(...usd):null;
     return <tr key={row.id}>
      <th scope="row">{row.name}<small>{row.unit}</small></th>
      {regions.map(region=><Cell key={region.id} cell={row.cells[region.id]} mode={mode} cheaper={low!==null&&row.cells[region.id]?.usd===low} label={row.name+' في '+region.name}
       onPick={reporting?()=>setPick({item:row.id,name:row.name,unit:row.unit,region:region.id,regionName:region.name,cell:row.cells[region.id]}):null}/>)}
     </tr>;
    })}</tbody>
   </table>
  </section>;})}</div>:<p className={styles.missing} role="status">لا توجد مادة بهذا الاسم في القائمة.</p>}
 <ItemSheet pick={pick} onClose={()=>setPick(null)}/>
 </section>;
}
