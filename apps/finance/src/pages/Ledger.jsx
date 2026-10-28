import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge, Card, ErrorBox, Loading, PageHeader, Stat, Table, api, fmtDate, inr, inr0, useAsync } from '@flix/shared';

/** Every rupee in and out on one screen. */
export default function Ledger() {
  const [kind, setKind] = useState('');
  const { data, error, reload } = useAsync(() => api.get('/payments'));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const sum = (k, f = 'amount') => data.filter((x) => x.kind === k).reduce((s, x) => s + x[f], 0);
  const rows = data.filter((x) => !kind || x.kind === kind);

  return (
    <>
      <PageHeader title="Payments ledger" subtitle="Money received from clients and paid to trainers" />
      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <Stat label="Money in" value={inr0(sum('IN'))} sub={`+ TDS credit ${inr0(sum('IN', 'tds'))}`} tone="green" />
        <Stat label="Money out" value={inr0(sum('OUT'))} tone="red" />
        <Stat label="Net cash" value={inr0(sum('IN') - sum('OUT'))} tone="blue" />
      </div>
      <Card
        flush
        title={`${rows.length} transactions`}
        actions={
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All</option>
            <option value="IN">Received from clients</option>
            <option value="OUT">Paid to trainers</option>
          </select>
        }
      >
        <Table
          rows={rows}
          columns={[
            { header: 'Date', render: (r) => fmtDate(r.date) },
            { header: 'Type', render: (r) => <Badge status={r.kind === 'IN' ? 'PAID' : 'OVERDUE'}>{r.kind === 'IN' ? 'Received' : 'Paid'}</Badge> },
            { header: 'Party', key: 'party' },
            { header: 'Document', render: (r) => <Link to={`/finance/${r.kind === 'IN' ? 'invoices' : 'purchase-orders'}/${r.docId}`}>{r.docNumber}</Link> },
            { header: 'Mode', key: 'mode' },
            { header: 'Reference', render: (r) => r.reference || '—' },
            { header: 'TDS', align: 'right', render: (r) => (r.tds ? inr(r.tds) : '—') },
            { header: 'Amount', align: 'right', render: (r) => <strong style={{ color: r.kind === 'IN' ? 'var(--green)' : 'var(--red)' }}>{r.kind === 'IN' ? '+' : '-'} {inr(r.amount)}</strong> },
          ]}
        />
      </Card>
    </>
  );
}
