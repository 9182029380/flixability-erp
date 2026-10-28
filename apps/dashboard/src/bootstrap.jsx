// Standalone mode: lets this micro frontend run on its own port for isolated development.
// Inside the shell this file is NOT used - the shell imports ./App directly.
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastHost } from '@flix/shared';
import App from './App';

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <div className="content">
      <Routes>
        <Route path="/dashboard/*" element={<App />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </div>
    <ToastHost />
  </BrowserRouter>,
);
