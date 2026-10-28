import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Table, Stat, api, fmtDate, inr, toast, useAsync } from '@flix/shared';
import CompanyHeader from '../components/CompanyHeader';
import PaymentModal from '../components/PaymentModal';

/** The PO as a printable document + the workflow actions (send, pay). */
export default function PODetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: po, error, reload } = useAsync(() => api.get(`/purchase-orders/${id}`), [id]);
  const { data: meta } = useAsync(() => api.get('/meta'));
  const [paying, setPaying] = useState(false);
  const [sending, setSending] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!po || !meta) return <Loading />;
  const t = po.trainer || {};

  async function send() {
    setSending(true);
    try {
      await api.post(`/purchase-orders/${id}/send`);
      toast(`PO e-mailed to ${t.email}`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  }
  async function pay(values) {
    await api.post(`/purchase-orders/${id}/payments`, values);
    toast('Payment recorded');
    setPaying(false);
    reload();
  }
  async function remove() {
    if (!window.confirm('Delete this draft PO?')) return;
    try {
      await api.del(`/purchase-orders/${id}`);
      nav('/finance/purchase-orders');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={po.number}
        subtitle={<><Badge status={po.status} /> &nbsp; {po.trainingTitle} · {po.trainerName}</>}
        actions={
          <>
            <Button variant="ghost" onClick={() => nav('/finance/purchase-orders')}>← Back</Button>
            <Button variant="ghost" onClick={() => window.print()}>Print / Save PDF</Button>
            {po.status === 'DRAFT' && <Button variant="ghost" className="danger-text" onClick={remove}>Delete</Button>}
            <Button variant={po.sentAt ? 'ghost' : 'primary'} disabled={sending} onClick={send}>
              {sending ? 'Sending…' : po.sentAt ? 'Resend to trainer' : 'Send PO to trainer'}
            </Button>
            {po.sentAt && po.balance > 0.5 && <Button variant="success" onClick={() => setPaying(true)}>Record payment</Button>}
          </>
        }
      />

      <div className="grid cols-4 no-print" style={{ marginBottom: 18 }}>
        <Stat label="Net payable" value={inr(po.net)} sub={`after TDS ${po.tdsPct}%`} />
        <Stat label="Paid" value={inr(po.paid)} tone="green" />
        <Stat label="Balance" value={inr(po.balance)} tone={po.balance > 0 ? 'amber' : 'green'} />
        <Stat label="Sent" value={po.sentAt ? fmtDate(po.sentAt) : 'Not sent'} tone="blue" />
      </div>

      <div className="doc" style={{ marginBottom: 18 }}>
        <CompanyHeader company={meta.company} title="PURCHASE ORDER">
          <div>PO No: <strong>{po.number}</strong></div>
          <div>Date: {fmtDate(po.poDate)}</div>
        </CompanyHeader>

        <div className="doc-parties">
          <div>
            <h4>Vendor (trainer)</h4>
            <strong>{t.name}</strong>
            <div className="muted">
              {t.email}<br />
              {t.phone}<br />
              PAN: {t.pan || '—'}{t.gstin ? ` · GSTIN: ${t.gstin}` : ''}
            </div>
          </div>
          <div>
            <h4>Payment details</h4>
            <div className="muted">
              {t.bankName || '—'}<br />
              A/c: {t.accountNumber || '—'}<br />
              IFSC: {t.ifsc || '—'}
            </div>
          </div>
        </div>

        <Table
          rows={[po]}
          columns={[
            { header: 'Description', render: (r) => (<><strong>{r.training?.title}</strong><span className="sub">{fmtDate(r.training?.startDate)} – {fmtDate(r.training?.endDate)} · {r.training?.mode} · for {r.clientName}</span></>) },
            { header: 'Amount', align: 'right', render: (r) => inr(r.subtotal) },
          ]}
        />
        <div className="doc-totals">
          <div><span>Sub-total</span><span>{inr(po.subtotal)}</span></div>
          {po.gstPct > 0 && <div><span>GST @ {po.gstPct}%</span><span>{inr(po.gst)}</span></div>}
          <div><span>Less: TDS @ {po.tdsPct}%</span><span>- {inr(po.tds)}</span></div>
          <div className="grand"><span>Net payable</span><span>{inr(po.net)}</span></div>
        </div>
        <div className="doc-foot">
          <strong>Terms:</strong> {po.terms}
        </div>
      </div>

      <div className="no-print">
        <Card title="Payments to trainer" flush>
          <Table
            rows={po.payments}
            empty={po.sentAt ? 'No payments recorded yet.' : 'Send the PO first, then record payments.'}
            columns={[
              { header: 'Date', render: (r) => fmtDate(r.date) },
              { header: 'Mode', key: 'mode' },
              { header: 'Reference', render: (r) => r.reference || '—' },
              { header: 'Amount', align: 'right', render: (r) => inr(r.amount) },
            ]}
          />
        </Card>
        <Card title="E-mail log" flush>
          <Table
            rows={po.emails}
            empty="Not e-mailed yet."
            columns={[
              { header: 'When', render: (r) => fmtDate(r.at) },
              { header: 'To', key: 'to' },
              { header: 'Subject', key: 'subject' },
              { header: 'Status', render: (r) => <Badge status={r.status === 'SENT' ? 'PAID' : r.status === 'FAILED' ? 'OVERDUE' : 'DRAFT'}>{r.status === 'LOGGED' ? 'Logged (no SMTP)' : r.status}</Badge> },
            ]}
          />
        </Card>
        <p className="muted">
          Training: <Link to="/training/trainings">view all trainings</Link>
        </p>
      </div>

      {paying && <PaymentModal title="Record payment to trainer" balance={po.balance} onSubmit={pay} onClose={() => setPaying(false)} />}
    </>
  );
}
