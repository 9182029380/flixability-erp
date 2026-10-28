import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Stat, Table, api, fmtDate, inr, inr0, label, useAsync } from '@flix/shared';

export default function POList() {
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const { data, error, reload } = useAsync(() => api.get('/purchase-orders'));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const sent = data.filter((p) => p.status !== 'DRAFT');
  const rows = data.filter((p) => !status || p.status === status);

  return (
    <>
      <PageHeader
        title="Purchase orders"
        subtitle="POs raised to trainers and the payments made against them"
        actions={<Button onClick={() => nav('/finance/purchase-orders/new')}>+ New PO</Button>}
      />
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Stat label="PO value (net of TDS)" value={inr0(sent.reduce((s, p) => s + p.net, 0))} sub={`${sent.length} POs issued`} />
        <Stat label="Paid to trainers" value={inr0(sent.reduce((s, p) => s + p.paid, 0))} tone="green" />
        <Stat label="Payable" value={inr0(sent.reduce((s, p) => s + p.balance, 0))} tone="amber" />
      </div>
      <Card
        flush
        title={`${rows.length} purchase orders`}
        actions={
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID'].map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
        }
      >
        <Table
          rows={rows}
          empty="No purchase orders yet. Create one from a training."
          onRowClick={(r) => nav(`/finance/purchase-orders/${r.id}`)}
          columns={[
            { header: 'PO no.', render: (r) => (<><Link to={`/finance/purchase-orders/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.number}</Link><span className="sub">{fmtDate(r.poDate)}</span></>) },
            { header: 'Trainer', key: 'trainerName' },
            { header: 'Training', render: (r) => (<>{r.trainingTitle}<span className="sub">{r.clientName}</span></>) },
            { header: 'Total', align: 'right', render: (r) => inr(r.total) },
            { header: 'TDS', align: 'right', render: (r) => inr(r.tds) },
            { header: 'Net payable', align: 'right', render: (r) => inr(r.net) },
            { header: 'Paid', align: 'right', render: (r) => inr(r.paid) },
            { header: 'Balance', align: 'right', render: (r) => inr(r.balance) },
            { header: 'Status', render: (r) => <Badge status={r.status} /> },
          ]}
        />
      </Card>
    </>
  );
}
