import { INDIAN_STATES, MasterPage, inr0 } from '@flix/shared';

const fields = [
  { name: 'name', label: 'Company name', required: true, span: 2 },
  { name: 'contactPerson', label: 'Contact person' },
  { name: 'email', label: 'E-mail (invoices are sent here)', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'gstin', label: 'GSTIN' },
  { name: 'state', label: 'State', type: 'select', required: true, options: INDIAN_STATES.map((s) => ({ value: s, label: s })), help: 'Decides CGST+SGST vs IGST on invoices' },
  { name: 'paymentTermsDays', label: 'Payment terms (days)', type: 'number', default: 30 },
  { name: 'address', label: 'Address', type: 'textarea', span: 2 },
];

const columns = [
  { header: 'Client', render: (r) => (<><strong>{r.name}</strong><span className="sub">{r.contactPerson} · {r.email}</span></>) },
  { header: 'State', key: 'state' },
  { header: 'GSTIN', render: (r) => r.gstin || '—' },
  { header: 'Terms', render: (r) => `${r.paymentTermsDays} days` },
  { header: 'Trainings', align: 'right', key: 'trainingCount' },
  { header: 'Billed (incl. GST)', align: 'right', render: (r) => inr0(r.billed) },
  { header: 'Received', align: 'right', render: (r) => inr0(r.received) },
  { header: 'Outstanding', align: 'right', render: (r) => (r.outstanding > 0 ? <strong>{inr0(r.outstanding)}</strong> : inr0(0)) },
];

export default function ClientsPage() {
  return (
    <MasterPage
      title="Corporate clients"
      subtitle="Companies we train, their GST details and what they owe us"
      noun="Client"
      endpoint="/clients"
      fields={fields}
      columns={columns}
      searchKeys={['name', 'contactPerson', 'email', 'state']}
      modalWide
    />
  );
}
