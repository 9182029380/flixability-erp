/**
 * DASHBOARD micro frontend - the single-screen business view.
 * One API call (/dashboard) returns every aggregate; this component only renders.
 */
import { Link, Route, Routes } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Stat, api, fmtDate, inr, inr0, inrCompact, label, useAsync } from '@flix/shared';

const COLORS = { revenue: '#4f46e5', cost: '#f59e0b', in: '#16a34a', out: '#dc2626' };

const moneyTip = (v) => inr0(v);

function BarList({ rows, color }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (!rows.length) return <div className="muted">No data yet.</div>;
  return rows.map((r) => (
    <div className="bar-row" key={r.id}>
      <span title={r.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
      <div className="bar-track"><div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: color }} /></div>
      <span className="num">{inrCompact(r.value)}</span>
    </div>
  ));
}

function Dashboard() {
  const { data: d, error, reload, loading } = useAsync(() => api.get('/dashboard'));
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!d) return <Loading />;
  const k = d.kpi;

  return (
    <>
      <PageHeader
        title="Business dashboard"
        subtitle="Revenue, cost, margin, receivables and payables at a glance"
        actions={<Button variant="ghost" onClick={reload} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>}
      />

      {/* Row 1: P&L */}
      <div className="grid cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Revenue (ex-GST)" value={inrCompact(k.revenue)} sub={`${inrCompact(k.billed)} billed incl. GST`} />
        <Stat label="Trainer cost" value={inrCompact(k.trainerCost)} sub={`TDS to deposit ${inrCompact(k.tdsPayable)}`} tone="amber" />
        <Stat label="Gross margin" value={inrCompact(k.grossMargin)} sub={`${k.marginPct}% of revenue`} tone="green" />
        <Stat label="Net cash position" value={inrCompact(k.netCash)} sub="collected − paid to trainers" tone="blue" />
      </div>
      {/* Row 2: working capital */}
      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <Stat label="Receivable from clients" value={inrCompact(k.receivable)} sub={`Collected ${inrCompact(k.collected)} · TDS credit ${inrCompact(k.tdsReceivable)}`} tone="amber" />
        <Stat label="Overdue" value={inrCompact(k.overdue)} sub={`${k.overdueCount} invoice${k.overdueCount === 1 ? '' : 's'} past due`} tone="red" />
        <Stat label="Payable to trainers" value={inrCompact(k.payable)} sub={`Paid so far ${inrCompact(k.paidToTrainers)}`} tone="red" />
        <Stat label="Activity" value={k.trainingsTotal} sub={`trainings · ${k.trainersTotal} trainers · ${k.clientsTotal} clients`} />
      </div>

      <div className="grid cols-2">
        <Card title="Revenue vs trainer cost (last 12 months)">
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={inrCompact} tick={{ fontSize: 12 }} width={70} />
                <Tooltip formatter={moneyTip} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill={COLORS.revenue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name="Trainer cost" fill={COLORS.cost} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Cash in vs cash out">
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={d.monthly}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={inrCompact} tick={{ fontSize: 12 }} width={70} />
                <Tooltip formatter={moneyTip} />
                <Legend />
                <Line type="monotone" dataKey="collected" name="Collected from clients" stroke={COLORS.in} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="paid" name="Paid to trainers" stroke={COLORS.out} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid cols-3">
        <Card title="Top clients by revenue"><BarList rows={d.topClients} color={COLORS.revenue} /></Card>
        <Card title="Top trainers by spend"><BarList rows={d.topTrainers} color={COLORS.cost} /></Card>
        <Card title="Receivables by status">
          <ul className="list">
            {d.invoiceStatus.map((s) => (
              <li key={s.status}>
                <span><Badge status={s.status} /> &nbsp;{s.count} invoice{s.count === 1 ? '' : 's'}</span>
                <strong className="mono">{s.status === 'PAID' ? '—' : inr0(s.amount)}</strong>
              </li>
            ))}
          </ul>
          <div className="muted" style={{ margin: '10px 0 4px' }}>Payables by status</div>
          <ul className="list">
            {d.poStatus.map((s) => (
              <li key={s.status}>
                <span><Badge status={s.status} /> &nbsp;{s.count} PO{s.count === 1 ? '' : 's'}</span>
                <strong className="mono">{s.status === 'PAID' ? '—' : inr0(s.amount)}</strong>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid cols-2">
        <Card title="Upcoming trainings" actions={<Link to="/training/trainings">All trainings →</Link>}>
          {d.upcoming.length === 0 ? (
            <div className="muted">Nothing scheduled.</div>
          ) : (
            <ul className="list">
              {d.upcoming.map((t) => (
                <li key={t.id}>
                  <span>
                    <strong>{t.title}</strong>
                    <span className="sub">{t.clientName} · {t.trainerName || 'Trainer not assigned'} · {fmtDate(t.startDate)}</span>
                  </span>
                  <span className="row gap-sm">
                    {!t.poId && t.trainerId && <Link to={`/finance/purchase-orders/new?trainingId=${t.id}`}>Create PO</Link>}
                    <Badge status={t.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Recent activity" actions={<Link to="/finance/payments">Ledger →</Link>}>
          <ul className="list">
            {d.activity.length === 0 && <li className="muted">No activity yet.</li>}
            {d.activity.map((a, i) => (
              <li key={i}>
                <span>
                  <span className="dot" style={{ background: a.type === 'IN' ? COLORS.in : a.type === 'OUT' ? COLORS.out : '#94a3b8' }} />
                  {a.text}
                </span>
                <span className="muted">{fmtDate(a.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="*" element={<Dashboard />} />
    </Routes>
  );
}
