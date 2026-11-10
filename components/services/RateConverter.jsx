'use client';
import {useState} from 'react';
import {ArrowLeftRight} from 'lucide-react';
import {formatNumber} from '@/lib/format';
import {RATE_CURRENCIES,RATE_REGIONS,YER,convertAmount,currencyName,regionName,transferEstimate} from '@/lib/exchangeRates';
import styles from './Services.module.css';

const CURRENCIES = [...RATE_CURRENCIES, YER];
const money = (value, currency) => formatNumber(value, {maximumFractionDigits: currency === 'YER' ? 0 : 2});

// Two calculators on the published rates: exchanging in one city, and an estimate of a rial
// transfer between the two cities. A changer's commission can be added; results are estimates.
export default function RateConverter({rates}) {
  const cities = RATE_REGIONS.filter(region => rates[region.id + ':USD']);
  const [mode, setMode] = useState('convert');
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('YER');
  const [region, setRegion] = useState(cities[0]?.id || 'sanaa');
  const [fee, setFee] = useState('');
  const [sender, setSender] = useState('aden');
  const [rials, setRials] = useState('100000');
  if (!cities.length) return null;
  const feeValue = Number(String(fee).replace(',', '.')) || 0;
  const converted = mode === 'convert' ? convertAmount({amount, from, to, region, rates, feePercent: feeValue}) : null;
  const receiver = sender === 'aden' ? 'sanaa' : 'aden';
  const transfer = mode === 'transfer' ? transferEstimate({amount: rials, fromRegion: sender, toRegion: receiver, rates, feePercent: feeValue}) : null;
  const canTransfer = rates['aden:USD'] && rates['sanaa:USD'];
  const select = (label, value, onChange, options) => <label className={styles.field}>{label}
    <select value={value} onChange={event => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
  </label>;
  const feeField = <label className={styles.field}>عمولة الصرّاف (اختياري)
    <input inputMode="decimal" value={fee} onChange={event => setFee(event.target.value)} placeholder="0" aria-describedby="fee-hint"/>
    <small id="fee-hint">نسبة مئوية، مثل 1 أو 2.5</small>
  </label>;
  return <div className={styles.tool}>
    <div className={styles.tabs} role="group" aria-label="نوع الحساب">
      <button type="button" aria-pressed={mode === 'convert'} onClick={() => setMode('convert')}>صرف عملة</button>
      {canTransfer && <button type="button" aria-pressed={mode === 'transfer'} onClick={() => setMode('transfer')}>حوالة بين المدينتين</button>}
    </div>
    {mode === 'convert' ? <>
      <div className={styles.fields}>
        <label className={styles.field}>المبلغ<input inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)}/></label>
        {select('من', from, value => { setFrom(value); if (value === to) setTo(value === 'YER' ? 'USD' : 'YER'); }, CURRENCIES.map(c => [c.id, c.short]))}
        <button type="button" className={styles.swap} onClick={() => { setFrom(to); setTo(from); }} aria-label="بدّل العملتين"><ArrowLeftRight size={16} aria-hidden="true"/> بدّل</button>
        {select('إلى', to, value => { setTo(value); if (value === from) setFrom(value === 'YER' ? 'USD' : 'YER'); }, CURRENCIES.filter(c => c.id !== from).map(c => [c.id, c.short]))}
        {select('بسعر', region, setRegion, cities.map(c => [c.id, c.name]))}
        {feeField}
      </div>
      <div className={styles.result} aria-live="polite">
        {converted ? <><strong>{money(converted.result, to)} {currencyName(to)}</strong>
          <p>بسعر {regionName(region)}: {from === 'YER' ? 'تشتري ' + currencyName(to) + ' بسعر البيع' : to === 'YER' ? 'تبيع ' + currencyName(from) + ' بسعر الشراء' : 'تبيع ثم تشتري عبر الريال اليمني'}{converted.fee > 0 ? ' · العمولة ' + money(converted.fee, to) + ' ' + currencyName(to) : ''}. السعر الفعلي قد يختلف قليلًا بين صرّاف وآخر.</p></>
          : <p>أدخل مبلغًا صحيحًا لعرض النتيجة.</p>}
      </div>
    </> : <>
      <div className={styles.fields}>
        <label className={styles.field}>المبلغ المرسل بالريال اليمني<input inputMode="decimal" value={rials} onChange={event => setRials(event.target.value)}/></label>
        {select('من', sender, setSender, [['aden', 'عدن إلى صنعاء'], ['sanaa', 'صنعاء إلى عدن']])}
        {feeField}
      </div>
      <div className={styles.result} aria-live="polite">
        {transfer ? <><strong>{money(transfer.result, 'YER')} ريال يمني في {regionName(receiver)}</strong>
          <p>تقدير بتحويل المبلغ إلى دولار بسعر {regionName(sender)} (نحو {money(transfer.dollars, 'USD')} دولار) ثم إلى ريال بسعر {regionName(receiver)}{transfer.fee > 0 ? '، بعد عمولة ' + money(transfer.fee, 'YER') + ' ريال' : ''}. شركات الحوالات تعلن عمولتها الخاصة، فاسألها عن المبلغ الذي سيُسلَّم فعلًا.</p></>
          : <p>أدخل مبلغًا صحيحًا لعرض التقدير.</p>}
      </div>
    </>}
  </div>;
}
