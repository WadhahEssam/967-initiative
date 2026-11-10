'use client';
import {useState} from 'react';
import {ArrowDownUp,ArrowLeft,ArrowRight} from 'lucide-react';
import {formatNumber} from '@/lib/format';
import {RATE_CURRENCIES,RATE_REGIONS,YER,convertAmount,currencyName,regionName,transferEstimate} from '@/lib/exchangeRates';
import styles from './Services.module.css';

const CURRENCIES = [...RATE_CURRENCIES, YER];
const SYMBOL = {USD: '$', SAR: 'ر.س', YER: 'ر.ي'};
const QUICK = {USD: [100, 500, 1000], SAR: [100, 500, 1000], YER: [50000, 100000, 500000]};
const money = (value, currency) => formatNumber(value, {maximumFractionDigits: currency === 'YER' ? 0 : 2});

function Choice({label, value, options, onChange}) {
  return <div className={styles.choice} role="group" aria-label={label}>
    {options.map(([id, name]) => <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{name}</button>)}
  </div>;
}

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
  const pickFrom = value => { setFrom(value); if (value === to) setTo(value === 'YER' ? 'USD' : 'YER'); setAmount(String(QUICK[value][0])); };
  const pickTo = value => { setTo(value); if (value === from) setFrom(value === 'YER' ? 'USD' : 'YER'); };
  const feeField = <details className={styles.options}>
    <summary>خيارات: عمولة الصرّاف{feeValue > 0 ? ' (' + feeValue + '%)' : ''}</summary>
    <label className={styles.field}>العمولة بالنسبة المئوية
      <input inputMode="decimal" value={fee} onChange={event => setFee(event.target.value)} placeholder="0" aria-describedby="fee-hint"/>
      <small id="fee-hint">مثل 1 أو 2.5. تُخصم من المبلغ الذي تحصل عليه.</small>
    </label>
  </details>;
  return <div className={styles.tool}>
    <div className={styles.toolTop}>
      <div className={styles.tabs} role="group" aria-label="نوع الحساب">
        <button type="button" aria-pressed={mode === 'convert'} onClick={() => setMode('convert')}>صرف عملة</button>
        {canTransfer && <button type="button" aria-pressed={mode === 'transfer'} onClick={() => setMode('transfer')}>حوالة بين المدينتين</button>}
      </div>
      {mode === 'convert' && cities.length > 1 && <Choice label="بسعر أي مدينة" value={region} onChange={setRegion} options={cities.map(c => [c.id, 'بسعر ' + c.name])}/>}
    </div>
    {mode === 'convert' ? <>
      <div className={styles.exchange}>
        <div className={styles.side}>
          <label className={styles.sideLabel} htmlFor="convert-amount">تدفع</label>
          <div className={styles.amountRow}>
            <input id="convert-amount" className={styles.amount} inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} aria-label={'المبلغ ب' + currencyName(from)}/>
            <span className={styles.symbol}>{SYMBOL[from]}</span>
          </div>
          <Choice label="العملة التي تدفعها" value={from} onChange={pickFrom} options={CURRENCIES.map(c => [c.id, c.short])}/>
          <div className={styles.quick}>{QUICK[from].map(value => <button key={value} type="button" onClick={() => setAmount(String(value))} aria-pressed={Number(amount) === value}>{formatNumber(value)}</button>)}</div>
        </div>
        <button type="button" className={styles.swap} onClick={() => { setFrom(to); setTo(from); }} aria-label="بدّل العملتين"><ArrowDownUp size={20} aria-hidden="true"/></button>
        <div className={styles.side} data-result>
          <span className={styles.sideLabel}>تحصل على</span>
          <div className={styles.amountRow} aria-live="polite">
            <output className={styles.amount}>{converted ? money(converted.result, to) : '—'}</output>
            <span className={styles.symbol}>{SYMBOL[to]}</span>
          </div>
          <Choice label="العملة التي تحصل عليها" value={to} onChange={pickTo} options={CURRENCIES.filter(c => c.id !== from).map(c => [c.id, c.short])}/>
        </div>
      </div>
      <p className={styles.explain}>{converted ? <>بسعر {regionName(region)}: {from === 'YER' ? 'تشتري ' + currencyName(to) + ' بسعر البيع' : to === 'YER' ? 'تبيع ' + currencyName(from) + ' بسعر الشراء' : 'تبيع ثم تشتري عبر الريال اليمني'}{converted.fee > 0 ? '، بعد عمولة ' + money(converted.fee, to) + ' ' + currencyName(to) : ''}. السعر الفعلي قد يختلف قليلًا بين صرّاف وآخر.</> : 'أدخل مبلغًا صحيحًا لعرض النتيجة.'}</p>
      {feeField}
    </> : <>
      <div className={styles.route}>
        <Choice label="اتجاه الحوالة" value={sender} onChange={setSender} options={[['aden', 'من عدن إلى صنعاء'], ['sanaa', 'من صنعاء إلى عدن']]}/>
      </div>
      <div className={styles.exchange}>
        <div className={styles.side}>
          <label className={styles.sideLabel} htmlFor="transfer-amount">ترسل من {regionName(sender)}</label>
          <div className={styles.amountRow}>
            <input id="transfer-amount" className={styles.amount} inputMode="decimal" value={rials} onChange={event => setRials(event.target.value)} aria-label="المبلغ المرسل بالريال اليمني"/>
            <span className={styles.symbol}>ر.ي</span>
          </div>
          <div className={styles.quick}>{QUICK.YER.map(value => <button key={value} type="button" onClick={() => setRials(String(value))} aria-pressed={Number(rials) === value}>{formatNumber(value)}</button>)}</div>
        </div>
        <span className={styles.swap} data-static aria-hidden="true">{sender === 'aden' ? <ArrowLeft size={20}/> : <ArrowRight size={20}/>}</span>
        <div className={styles.side} data-result>
          <span className={styles.sideLabel}>يصل في {regionName(receiver)} نحو</span>
          <div className={styles.amountRow} aria-live="polite">
            <output className={styles.amount}>{transfer ? money(transfer.result, 'YER') : '—'}</output>
            <span className={styles.symbol}>ر.ي</span>
          </div>
          {transfer && <small className={styles.sideNote}>ريال يمني في {regionName(receiver)}</small>}
        </div>
      </div>
      <p className={styles.explain}>{transfer ? <>تقدير بتحويل المبلغ إلى دولار بسعر {regionName(sender)} (نحو {money(transfer.dollars, 'USD')} دولار) ثم إلى ريال بسعر {regionName(receiver)}{transfer.fee > 0 ? '، بعد عمولة ' + money(transfer.fee, 'YER') + ' ريال' : ''}. شركات الحوالات تعلن عمولتها الخاصة، فاسألها عن المبلغ الذي سيُسلَّم فعلًا.</> : 'أدخل مبلغًا صحيحًا لعرض التقدير.'}</p>
      {feeField}
    </>}
  </div>;
}
