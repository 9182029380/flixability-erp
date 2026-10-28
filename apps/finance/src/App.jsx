/**
 * FINANCE micro frontend - the money flow.
 *   Payables  : purchase-orders (list / new / detail -> send to trainer -> record payments)
 *   Receivables: invoices      (list / new / detail -> send to client  -> record receipts)
 *   payments   : combined ledger of money in and money out
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import POList from './pages/POList';
import PONew from './pages/PONew';
import PODetail from './pages/PODetail';
import InvoiceList from './pages/InvoiceList';
import InvoiceNew from './pages/InvoiceNew';
import InvoiceDetail from './pages/InvoiceDetail';
import Ledger from './pages/Ledger';

export default function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/finance/purchase-orders" replace />} />
      <Route path="purchase-orders" element={<POList />} />
      <Route path="purchase-orders/new" element={<PONew />} />
      <Route path="purchase-orders/:id" element={<PODetail />} />
      <Route path="invoices" element={<InvoiceList />} />
      <Route path="invoices/new" element={<InvoiceNew />} />
      <Route path="invoices/:id" element={<InvoiceDetail />} />
      <Route path="payments" element={<Ledger />} />
    </Routes>
  );
}
