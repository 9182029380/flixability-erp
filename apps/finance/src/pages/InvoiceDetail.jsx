import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Stat, Table, api, fmtDate, inr, toast, useAsync } from '@flix/shared';
import CompanyHeader from '../components/CompanyHeader';
import PaymentModal from '../components/PaymentModal';

/** Tax invoice as a printable document + workflow actions (send, record receipt). */
export default function InvoiceDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: inv, error, reload } = useAsync(() => api.get(`/invoices/${id}`), [id]);
  const { data: meta } = useAsync(() => api.get('/meta'));
  const [receiving, setReceiving] = useState(false);
  const [sending, setSending] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!inv || !meta) return <Loading />;
  const c = inv.client || {};
  const bank = meta.company.bank;

  async function send() {
    setSending(true);
    try {
      await api.post(`/invoices/${id}/send`);
      toast(`Invoice e-mailed to ${c.email}`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  }
  async function receive(values) {
    await api.post(`/invoices/${id}/receipts`, values);
    toast('Receipt recorded');
    setReceiving(false);
    reload();
  }
  async function remove() {
    if (!window.confirm('Delete this draft invoice?')) return;
    try {
      await api.del(`/invoices/${id}`);
      nav('/finance/invoices');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title={inv.number}
        subtitle={<><Badge status={inv.status} /> &nbsp; {inv.clientName} · due {fmtDate(inv.dueDate)}</>}
        actions={
          <>
            <Button variant="ghost" onClick={() => nav('/finance/invoices')}>← Back</Button>
            <Button variant="ghost" onClick={() => window.print()}>Print / Save PDF</Button>
            {inv.status === 'DRAFT' && <Button variant="ghost" className="danger-text" onClick={remove}>Delete</Button>}
            <Button variant={inv.sentAt ? 'ghost' : 'primary'} disabled={sending} onClick={send}>
              {sending ? 'Sending…' : inv.sentAt ? 'Resend to client' : 'Send invoice to client'}
            </Button>
            {inv.sentAt && inv.balance > 0.5 && <Button variant="success" onClick={() => setReceiving(true)}>Record receipt</Button>}
          </>
        }
      />

      <div className="grid cols-4 no-print" style={{ marginBottom: 18 }}>
        <Stat label="Invoice total" value={inr(inv.total)} sub={`GST ${inr(inv.gst)}`} />
        <Stat label="Received (cash)" value={inr(inv.received)} tone="green" />
        <Stat label="TDS deducted" value={inr(inv.tdsDeducted)} tone="blue" />
        <Stat label="Balance due" value={inr(inv.balance)} tone={inv.status === 'OVERDUE' ? 'red' : inv.balance > 0 ? 'amber' : 'green'} />
      </div>

      <div className="doc" style={{ marginBottom: 18 }}>
        <CompanyHeader company={meta.company} title="TAX INVOICE">
          <div>Invoice No: <strong>{inv.number}</strong></div>
          <div>Date: {fmtDate(inv.invoiceDate)}</div>
          <div>Due: {fmtDate(inv.dueDate)}</div>
        </CompanyHeader>

        <div className="doc-parties">
          <div>
            <h4>Bill to</h4>
            <strong>{c.name}</strong>
            <div className="muted">
              {c.address}<br />
              {c.state} · GSTIN: {c.gstin || '—'}<br />
              Attn: {c.contactPerson || '—'}
            </div>
          </div>
          <div>
            <h4>Pay to</h4>
            <div className="muted">
              {bank.accountName}<br />
              {bank.name} · A/c {bank.accountNumber}<br />
              IFSC {bank.ifsc}
            </div>
          </div>
        </div>

        <Table
          rows={[inv]}
          columns={[
            { header: 'Description', render: (r) => (<><strong>{r.description}</strong><span className="sub">{fmtDate(r.training?.startDate)} – {fmtDate(r.training?.endDate)} · {r.training?.participants || '—'} participants</span></>) },
            { header: 'GST %', align: 'right', render: (r) => `${r.gstPct}%` },
            { header: 'Amount', align: 'right', render: (r) => inr(r.subtotal) },
          ]}
        />
        <div className="doc-totals">
          <div><span>Taxable value</span><span>{inr(inv.subtotal)}</span></div>
          {inv.interState ? (
            <div><span>IGST @ {inv.gstPct}%</span><span>{inr(inv.igst)}</span></div>
          ) : (
            <>
              <div><span>CGST @ {inv.gstPct / 2}%</span><span>{inr(inv.cgst)}</span></div>
              <div><span>SGST @ {inv.gstPct / 2}%</span><span>{inr(inv.sgst)}</span></div>
            </>
          )}
          <div className="grand"><span>Total</span><span>{inr(inv.total)}</span></div>
          {inv.settled > 0 && <div><span>Received (incl. TDS)</span><span>- {inr(inv.settled)}</span></div>}
          {inv.settled > 0 && <div><strong>Balance due</strong><strong>{inr(inv.balance)}</strong></div>}
        </div>
        {inv.notes && <div className="doc-foot">{inv.notes}</div>}
      </div>

      <div className="no-print">
        <Card title="Receipts from client" flush>
          <Table
            rows={inv.receipts}
            empty={inv.sentAt ? 'No receipts recorded yet.' : 'Send the invoice first, then record receipts.'}
            columns={[
              { header: 'Date', render: (r) => fmtDate(r.date) },
              { header: 'Mode', key: 'mode' },
              { header: 'Reference', render: (r) => r.reference || '—' },
              { header: 'TDS deducted', align: 'right', render: (r) => inr(r.tdsDeducted) },
              { header: 'Amount received', align: 'right', render: (r) => inr(r.amount) },
            ]}
          />
        </Card>
        <Card title="E-mail log" flush>
          <Table
            rows={inv.emails}
            empty="Not e-mailed yet."
            columns={[
              { header: 'When', render: (r) => fmtDate(r.at) },
              { header: 'To', key: 'to' },
              { header: 'Subject', key: 'subject' },
              { header: 'Status', render: (r) => <Badge status={r.status === 'SENT' ? 'PAID' : r.status === 'FAILED' ? 'OVERDUE' : 'DRAFT'}>{r.status === 'LOGGED' ? 'Logged (no SMTP)' : r.status}</Badge> },
            ]}
          />
        </Card>
      </div>

      {receiving && <PaymentModal title="Record receipt from client" balance={inv.balance} withTds onSubmit={receive} onClose={() => setReceiving(false)} />}
    </>
  );
}
