import { MasterPage, inr0 } from '@flix/shared';

const fields = [
  { name: 'name', label: 'Full name', required: true },
  { name: 'email', label: 'E-mail (POs are sent here)', type: 'email', required: true },
  { name: 'phone', label: 'Phone' },
  { name: 'city', label: 'City' },
  { name: 'expertise', label: 'Expertise / domain', span: 2, placeholder: 'e.g. Leadership, Agile, Cloud' },
  { name: 'ratePerDay', label: 'Rate per day (₹)', type: 'number' },
  { name: 'pan', label: 'PAN', help: 'Needed for TDS' },
  { name: 'gstin', label: 'GSTIN (if registered)' },
  { name: 'bankName', label: 'Bank name' },
  { name: 'accountNumber', label: 'Account number' },
  { name: 'ifsc', label: 'IFSC' },
  { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
];

const columns = [
  { header: 'Trainer', render: (r) => (<><strong>{r.name}</strong><span className="sub">{r.email}</span></>) },
  { header: 'Expertise', render: (r) => (<>{r.expertise || '—'}<span className="sub">{r.city}</span></>) },
  { header: 'Rate / day', align: 'right', render: (r) => (r.ratePerDay ? inr0(r.ratePerDay) : '—') },
  { header: 'Trainings', align: 'right', key: 'trainingCount' },
  { header: 'PO value (net)', align: 'right', render: (r) => inr0(r.poTotal) },
  { header: 'Paid', align: 'right', render: (r) => inr0(r.paid) },
  { header: 'Payable', align: 'right', render: (r) => (r.outstanding > 0 ? <strong>{inr0(r.outstanding)}</strong> : inr0(0)) },
];

export default function TrainersPage() {
  return (
    <MasterPage
      title="Trainers"
      subtitle="Trainer profiles, bank details and what we owe them"
      noun="Trainer"
      endpoint="/trainers"
      fields={fields}
      columns={columns}
      searchKeys={['name', 'email', 'expertise', 'city']}
      modalWide
    />
  );
}
