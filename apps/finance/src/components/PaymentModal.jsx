import { DataForm, Modal, PAYMENT_MODES, todayISO } from '@flix/shared';

/**
 * Used for both directions:
 *  - paying a trainer against a PO      (withTds = false)
 *  - receiving money from a client      (withTds = true: the client may deduct TDS)
 */
export default function PaymentModal({ title, balance, withTds, onSubmit, onClose }) {
  const fields = [
    { name: 'amount', label: withTds ? 'Amount received (₹)' : 'Amount paid (₹)', type: 'number', required: !withTds, default: withTds ? '' : balance },
    ...(withTds ? [{ name: 'tdsDeducted', label: 'TDS deducted by client (₹)', type: 'number', default: 0, help: 'Counts towards settling the invoice' }] : []),
    { name: 'date', label: 'Date', type: 'date', required: true, default: todayISO() },
    { name: 'mode', label: 'Mode', type: 'select', required: true, default: 'NEFT', options: PAYMENT_MODES.map((m) => ({ value: m, label: m })) },
    { name: 'reference', label: 'UTR / cheque / reference no.', span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
  ];
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>
        Outstanding balance: <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(balance)}</strong>
      </p>
      <DataForm fields={fields} onSubmit={onSubmit} onCancel={onClose} submitLabel="Record payment" />
    </Modal>
  );
}
