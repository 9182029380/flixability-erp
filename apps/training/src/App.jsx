/**
 * TRAINING micro frontend - master data and the training schedule.
 *   /training/trainings  schedule a training, assign client + trainer, set fees
 *   /training/trainers   trainer profiles + bank details (used for PO / payment)
 *   /training/clients    corporate clients (GSTIN, state, payment terms)
 * From a training row the user jumps straight into the finance MFE to raise the PO / invoice.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import TrainersPage from './pages/TrainersPage';
import ClientsPage from './pages/ClientsPage';
import TrainingsPage from './pages/TrainingsPage';

export default function App() {
  return (
    <Routes>
      <Route index element={<Navigate to="/training/trainings" replace />} />
      <Route path="trainings" element={<TrainingsPage />} />
      <Route path="trainers" element={<TrainersPage />} />
      <Route path="clients" element={<ClientsPage />} />
    </Routes>
  );
}
