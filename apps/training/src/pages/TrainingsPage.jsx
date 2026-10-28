import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, MasterPage, fmtDate, inr0, label } from '@flix/shared';

const STATUSES = ['PLANNED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const opts = (arr) => arr.map((v) => ({ value: v, label: label(v) }));

/** Form fields need the list of clients/trainers, so `fields` is a function of the loaded lookups. */
const fields = ({ clients, trainers }) => [
  { name: 'title', label: 'Training title', required: true, span: 2 },
  { name: 'clientId', label: 'Corporate client', type: 'select', required: true, options: clients.map((c) => ({ value: c.id, label: c.name })) },
  {
    name: 'trainerId',
    label: 'Trainer',
    type: 'select',
    options: trainers.map((t) => ({ value: t.id, label: `${t.name}${t.expertise ? ' - ' + t.expertise : ''}` })),
    help: 'Required before a PO can be raised',
  },
  { name: 'startDate', label: 'Start date', type: 'date', required: true },
  { name: 'endDate', label: 'End date', type: 'date', required: true },
  { name: 'mode', label: 'Mode', type: 'select', options: opts(['ONLINE', 'ONSITE', 'HYBRID']), default: 'ONLINE' },
  { name: 'status', label: 'Status', type: 'select', options: opts(STATUSES), default: 'PLANNED' },
  { name: 'days', label: 'Training days', type: 'number' },
  { name: 'participants', label: 'Participants', type: 'number' },
  { name: 'trainerFee', label: 'Trainer fee (₹) - we pay', type: 'number', help: 'Becomes the PO amount' },
  { name: 'clientFee', label: 'Client fee (₹) - we bill, excl. GST', type: 'number', help: 'Becomes the invoice amount' },
  { name: 'venue', label: 'Venue / meeting link', span: 2 },
];

const columns = () => [
  { header: 'Training', render: (r) => (<><strong>{r.title}</strong><span className="sub">{fmtDate(r.startDate)} → {fmtDate(r.endDate)} · <Badge status={r.mode} /></span></>) },
  { header: 'Client', key: 'clientName' },
  { header: 'Trainer', render: (r) => r.trainerName || <span className="muted">Not assigned</span> },
  { header: 'Trainer fee', align: 'right', render: (r) => inr0(r.trainerFee) },
  { header: 'Client fee', align: 'right', render: (r) => inr0(r.clientFee) },
  { header: 'Margin', align: 'right', render: (r) => (<span style={{ color: r.margin < 0 ? 'var(--red)' : 'inherit' }}>{inr0(r.margin)}</span>) },
  { header: 'Status', render: (r) => <Badge status={r.status} /> },
  {
    header: 'PO / Invoice',
    render: (r) => (
      <div className="muted">
        PO: {r.poId ? <Link to={`/finance/purchase-orders/${r.poId}`}>{r.poStatus && label(r.poStatus)}</Link> : '—'}
        <br />
        Inv: {r.invoiceId ? <Link to={`/finance/invoices/${r.invoiceId}`}>{r.invoiceStatus && label(r.invoiceStatus)}</Link> : '—'}
      </div>
    ),
  },
];

/** Shortcuts that hand over to the Finance micro frontend with the training pre-selected. */
function RowActions({ row }) {
  const nav = useNavigate();
  if (row.status === 'CANCELLED') return null;
  return (
    <>
      {!row.poId && row.trainerId && (
        <Button variant="ghost" size="sm" onClick={() => nav(`/finance/purchase-orders/new?trainingId=${row.id}`)}>
          Create PO
        </Button>
      )}
      {!row.invoiceId && (
        <Button variant="ghost" size="sm" onClick={() => nav(`/finance/invoices/new?trainingId=${row.id}`)}>
          Invoice
        </Button>
      )}
    </>
  );
}

export default function TrainingsPage() {
  return (
    <MasterPage
      title="Trainings"
      subtitle="Schedule trainings, link each one to a client and a trainer, then raise the PO and invoice"
      noun="Training"
      endpoint="/trainings"
      lookups={{ clients: '/clients', trainers: '/trainers' }}
      fields={fields}
      columns={columns}
      searchKeys={['title', 'clientName', 'trainerName']}
      filter={{ key: 'status', label: 'statuses', options: opts(STATUSES) }}
      rowActions={(row) => <RowActions row={row} />}
      modalWide
    />
  );
}
