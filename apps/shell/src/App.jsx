/**
 * SHELL (host application)
 * Owns the layout, navigation and the router. Each business area is a remote
 * micro frontend loaded lazily over the network: `import('training/App')` is
 * resolved at runtime through Module Federation (see webpack.config.js).
 * If one remote is down, only that section shows an error - the rest keeps working.
 */
import { Component, lazy, Suspense } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { Button, Loading, ToastHost } from '@flix/shared';

const DashboardApp = lazy(() => import('dashboard/App'));
const TrainingApp = lazy(() => import('training/App'));
const FinanceApp = lazy(() => import('finance/App'));

class RemoteBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card card-body">
        <h3>This module is unavailable</h3>
        <p className="muted">The micro frontend could not be loaded. Check that it is running/deployed and try again.</p>
        <pre className="muted">{String(this.state.error.message || this.state.error)}</pre>
        <Button onClick={() => this.setState({ error: null })}>Retry</Button>
      </div>
    );
  }
}

const Remote = ({ children }) => (
  <RemoteBoundary>
    <Suspense fallback={<Loading text="Loading module…" />}>{children}</Suspense>
  </RemoteBoundary>
);

const link = ({ isActive }) => `nav-link ${isActive ? 'active' : ''}`;

function financialYear() {
  const d = new Date();
  const s = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `FY ${s}-${String(s + 1).slice(2)}`;
}

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">F</div>
          <div>
            <b>Flixability</b>
            <small>Finance ERP</small>
          </div>
        </div>
        <NavLink to="/dashboard" className={link}>
          Dashboard
        </NavLink>

        <div className="nav-group">Training</div>
        <NavLink to="/training/trainings" className={link}>
          Trainings
        </NavLink>
        <NavLink to="/training/trainers" className={link}>
          Trainers
        </NavLink>
        <NavLink to="/training/clients" className={link}>
          Corporate clients
        </NavLink>

        <div className="nav-group">Payables (trainers)</div>
        <NavLink to="/finance/purchase-orders" className={link}>
          Purchase orders
        </NavLink>

        <div className="nav-group">Receivables (clients)</div>
        <NavLink to="/finance/invoices" className={link}>
          Invoices
        </NavLink>

        <div className="nav-group">Money</div>
        <NavLink to="/finance/payments" className={link}>
          Payments ledger
        </NavLink>
      </aside>

      <div className="main">
        <header className="topbar">
          <strong>Flixability Cloud Services Pvt Ltd</strong>
          <span className="muted">{financialYear()}</span>
        </header>
        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/*" element={<Remote><DashboardApp /></Remote>} />
            <Route path="/training/*" element={<Remote><TrainingApp /></Remote>} />
            <Route path="/finance/*" element={<Remote><FinanceApp /></Remote>} />
            <Route path="*" element={<div className="card card-body">Page not found.</div>} />
          </Routes>
        </main>
      </div>
      <ToastHost />
    </div>
  );
}
