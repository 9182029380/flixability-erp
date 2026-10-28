import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Card, ErrorBox, Field, Loading, PageHeader, api, fmtDate, inr, toast, todayISO, useAsync } from '@flix/shared';

/** Receivable flow, step 1: pick a training -> client, fee, GST type and due date are derived. */
export default function InvoiceNew() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const { data, error } = useAsync(async () => ({
    trainings: await api.get('/trainings'),
    clients: await api.get('/clients'),
    meta: await api.get('/meta'),
  }));
  const [f, setF] = useState({ trainingId: params.get('trainingId') || '', amount: '', gstPct: '', invoiceDate: todayISO(), dueDays: '', description: '', notes: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const eligible = (data?.trainings || []).filter((t) => !t.invoiceId && t.status !== 'CANCELLED');
  const training = eligible.find((t) => t.id === f.trainingId);
  const client = training && data.clients.find((c) => c.id === training.clientId);

  useEffect(() => {
    if (!data) return;
    setF((x) => ({
      ...x,
      amount: training ? training.clientFee : '',
      dueDays: client ? client.paymentTermsDays : x.dueDays,
      gstPct: x.gstPct === '' ? data.meta.defaults.invoiceGstPct : x.gstPct,
    }));
  }, [data, f.trainingId]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const amount = Number(f.amount) || 0;
  const gst = (amount * (Number(f.gstPct) || 0)) / 100;
  const interState = client && client.state.toLowerCase() !== data.meta.company.state.toLowerCase();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      const inv = await api.post('/invoices', { ...f, amount: Number(f.amount), gstPct: Number(f.gstPct), dueDays: Number(f.dueDays) });
      toast(`Invoice ${inv.number} created`);
      nav(`/finance/invoices/${inv.id}`);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="New invoice" subtitle="Bill a corporate client for a training" />
      <Card>
        <form onSubmit={submit}>
          <div className="form-grid">
            <Field label="Training *" span={2} help={eligible.length ? undefined : 'Every training already has an invoice.'}>
              <select className="input" required value={f.trainingId} onChange={set('trainingId')}>
                <option value="">— Select training —</option>
                {eligible.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.clientName} · {fmtDate(t.startDate)}
                  </option>
                ))}
              </select>
            </Field>
            {client && (
              <div className="muted" style={{ gridColumn: 'span 2' }}>
                Bill to: <strong>{client.name}</strong> ({client.state}) · {interState ? 'Inter-state supply → IGST' : 'Intra-state supply → CGST + SGST'}
              </div>
            )}
            <Field label="Amount (₹, before GST) *">
              <input className="input" type="number" min="0" step="any" required value={f.amount} onChange={set('amount')} />
            </Field>
            <Field label="GST %">
              <input className="input" type="number" min="0" max="100" step="any" value={f.gstPct} onChange={set('gstPct')} />
            </Field>
            <Field label="Invoice date">
              <input className="input" type="date" value={f.invoiceDate} onChange={set('invoiceDate')} />
            </Field>
            <Field label="Payment due in (days)">
              <input className="input" type="number" min="0" value={f.dueDays} onChange={set('dueDays')} />
            </Field>
            <Field label="Invoice total (incl. GST)" span={2}>
              <input className="input" disabled value={inr(amount + gst)} />
            </Field>
            <Field label="Description (optional)" span={2}>
              <input className="input" value={f.description} onChange={set('description')} placeholder="Defaults to 'Corporate training services - <title>'" />
            </Field>
            <Field label="Notes (optional)" span={2}>
              <textarea className="input" rows={2} value={f.notes} onChange={set('notes')} />
            </Field>
          </div>
          {err && <div className="form-error">{err}</div>}
          <div className="form-actions">
            <Button type="button" variant="ghost" onClick={() => nav('/finance/invoices')}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !f.trainingId}>
              {busy ? 'Creating…' : 'Create invoice'}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
