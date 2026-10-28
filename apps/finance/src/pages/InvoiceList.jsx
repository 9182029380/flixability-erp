import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Stat, Table, api, fmtDate, inr, inr0, label, useAsync } from '@flix/shared';

export default function InvoiceList() {
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const { data, error, reload } = useAsync(() => api.get('/invoices'));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const sent = data.filter((i) => i.status !== 'DRAFT');
  const rows = data.filter((i) => !status || i.status === status);

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Invoices to corporate clients and what has been collected"
        actions={<Button onClick={() => nav('/finance/invoices/new')}>+ New invoice</Button>}
      />
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat label="Billed (incl. GST)" value={inr0(sent.reduce((s, i) => s + i.total, 0))} sub={`${sent.length} invoices sent`} />
        <Stat label="Collected (cash + TDS)" value={inr0(sent.reduce((s, i) => s + i.settled, 0))} tone="green" />
        <Stat label="Outstanding" value={inr0(sent.reduce((s, i) => s + i.balance, 0))} tone="amber" />
        <Stat label="Overdue" value={inr0(sent.filter((i) => i.status === 'OVERDUE').reduce((s, i) => s + i.balance, 0))} tone="red" />
      </div>
      <Card
        flush
        title={`${rows.length} invoices`}
        actions={
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['DRAFT', 'SENT', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        }
      >
        <Table
          rows={rows}
          empty="No invoices yet. Create one from a training."
          onRowClick={(r) => nav(`/finance/invoices/${r.id}`)}
          columns={[
            { header: 'Invoice no.', render: (r) => (<><Link to={`/finance/invoices/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.number}</Link><span className="sub">{fmtDate(r.invoiceDate)}</span></>) },
            { header: 'Client', key: 'clientName' },
            { header: 'Training', key: 'trainingTitle' },
            { header: 'Due', render: (r) => fmtDate(r.dueDate) },
            { header: 'Total', align: 'right', render: (r) => inr(r.total) },
            { header: 'Received', align: 'right', render: (r) => inr(r.settled) },
            { header: 'Balance', align: 'right', render: (r) => inr(r.balance) },
            { header: 'Status', render: (r) => <Badge status={r.status} /> },
          ]}
        />
      </Card>
    </>
  );
}
