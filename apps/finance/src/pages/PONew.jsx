import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, ErrorBox, Field, Loading, PageHeader, api, fmtDate, inr, toast, useAsync } from '@flix/shared';

/** Step 1 of the payable flow: pick a training -> the trainer + fee are pulled in automatically. */
export default function PONew() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { data, error } = useAsync(async () => ({ trainings: await api.get('/trainings'), meta: await api.get('/meta') }));
  const [f, setF] = useState({ trainingId: params.get('trainingId') || '', amount: '', gstPct: '', tdsPct: '', terms: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const eligible = (data?.trainings || []).filter((t) => t.trainerId && !t.poId && t.status !== 'CANCELLED');
  const training = eligible.find((t) => t.id === f.trainingId);

  // Pre-fill numbers once data is loaded or the training changes
  useEffect(() => {
    if (!data) return;
    setF((x) => ({
      ...x,
      amount: training ? training.trainerFee : '',
      gstPct: x.gstPct === '' ? data.meta.defaults.poGstPct : x.gstPct,
      tdsPct: x.tdsPct === '' ? data.meta.defaults.poTdsPct : x.tdsPct,
      terms: x.terms || data.meta.defaults.poTerms,
    }));
  }, [data, f.trainingId]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const amount = Number(f.amount) || 0;
  const gst = (amount * (Number(f.gstPct) || 0)) / 100;
  const tds = (amount * (Number(f.tdsPct) || 0)) / 100;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const po = await api.post('/purchase-orders', { ...f, amount: Number(f.amount), gstPct: Number(f.gstPct), tdsPct: Number(f.tdsPct) });
      toast(`PO ${po.number} created`);
      nav(`/finance/purchase-orders/${po.id}`);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New purchase order" subtitle="Raise a PO to the trainer assigned to a training" />
      <Card>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Training *" span={2} help={eligible.length ? undefined : 'No eligible trainings: assign a trainer to a training first (one PO per training).'}>
              <select className="input" required value={f.trainingId} onChange={set('trainingId')}>
                <option value="">— Select training —</option>
                {eligible.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.trainerName} · {fmtDate(t.startDate)}
                  </option>
                ))}
              </select>
            </Field>
            {training && (
              <div className="span2 muted" style={{ gridColumn: 'span 2' }}>
                Trainer: <strong>{training.trainerName}</strong> · Client: {training.clientName} · Agreed trainer fee: {inr(training.trainerFee)}
              </div>
            )}
            <Field label="PO amount (₹, before GST) *">
              <input className="input" type="number" min="0" step="any" required value={f.amount} onChange={set('amount')} />
            </Field>
            <Field label="GST %" help="0 if the trainer is not GST registered">
              <input className="input" type="number" min="0" max="100" step="any" value={f.gstPct} onChange={set('gstPct')} />
            </Field>
            <Field label="TDS % (194J)">
              <input className="input" type="number" min="0" max="100" step="any" value={f.tdsPct} onChange={set('tdsPct')} />
            </Field>
            <Field label="Net payable to trainer">
              <input className="input" disabled value={inr(amount + gst - tds)} />
            </Field>
            <Field label="Terms & conditions" span={2}>
              <textarea className="input" rows={3} value={f.terms} onChange={set('terms')} />
            </Field>
          </div>
          {err && <div className="form-error">{err}</div>}
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => nav('/finance/purchase-orders')}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !f.trainingId}>
              {busy ? 'Creating…' : 'Create PO'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
