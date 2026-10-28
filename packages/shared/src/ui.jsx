import { useEffect, useState } from 'react';
import './styles.css';
import { label } from './format';

/* ------------------------------ layout ------------------------------ */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header no-print">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      <div className="row gap">{actions}</div>
    </div>
  );
}

export function Card({ title, actions, children, flush, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <h3>{title}</h3>
          <div className="row gap">{actions}</div>
        </header>
      )}
      <div className={flush ? '' : 'card-body'}>{children}</div>
    </section>
  );
}

export function Stat({ label: l, value, sub, tone = '' }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-label">{l}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

/* ------------------------------ atoms ------------------------------- */
const TONES = {
  DRAFT: 'gray', PLANNED: 'gray',
  SENT: 'blue', CONFIRMED: 'blue', ONLINE: 'blue',
  PARTIALLY_PAID: 'amber', IN_PROGRESS: 'amber', HYBRID: 'amber',
  PAID: 'green', COMPLETED: 'green',
  OVERDUE: 'red', CANCELLED: 'red',
  ONSITE: 'violet',
};
export function Badge({ status, children }) {
  return <span className={`badge ${TONES[status] || 'gray'}`}>{children || label(status)}</span>;
}

export function Button({ variant = 'primary', size, className = '', ...rest }) {
  return <button className={`btn btn-${variant} ${size === 'sm' ? 'btn-sm' : ''} ${className}`} {...rest} />;
}

export function Loading({ text = 'Loading…' }) {
  return <div className="state muted">{text}</div>;
}
export function ErrorBox({ error, onRetry }) {
  return (
    <div className="state error-box">
      <strong>Something went wrong.</strong> {error?.message}
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return <input className="input search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

export function KeyValue({ items }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------ table ------------------------------- */
/** columns: [{ header, key?, render?(row), align?: 'right' }] */
export function Table({ columns, rows, onRowClick, empty = 'Nothing here yet.' }) {
  if (!rows?.length) return <div className="state muted">{empty}</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className={c.align === 'right' ? 'num' : ''}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r.id || ri} className={onRowClick ? 'clickable' : ''} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              {columns.map((c, i) => (
                <td key={i} className={c.align === 'right' ? 'num' : ''}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------ modal ------------------------------- */
export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="card-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------ forms ------------------------------- */
export function Field({ label: l, span, help, children }) {
  return (
    <label className={`field ${span === 2 ? 'span2' : ''}`}>
      <span className="field-label">{l}</span>
      {children}
      {help && <span className="field-help">{help}</span>}
    </label>
  );
}

/**
 * Config-driven form.
 * fields: [{ name, label, type: text|number|email|date|select|textarea, options?, required?, span?, help?, default? }]
 */
export function DataForm({ fields, initial = {}, onSubmit, onCancel, submitLabel = 'Save' }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? f.default ?? ''])),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (name, v) => setValues((x) => ({ ...x, [name]: v }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const out = {};
      fields.forEach((f) => {
        let v = values[f.name];
        if (f.type === 'number') v = v === '' ? null : Number(v);
        out[f.name] = v;
      });
      await onSubmit(out);
    } catch (ex) {
      setError(ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        {fields.map((f) => (
          <Field key={f.name} label={`${f.label}${f.required ? ' *' : ''}`} span={f.span} help={f.help}>
            {f.type === 'select' ? (
              <select className="input" value={values[f.name]} required={f.required} onChange={(e) => set(f.name, e.target.value)}>
                <option value="">— Select —</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea className="input" rows={3} value={values[f.name]} onChange={(e) => set(f.name, e.target.value)} />
            ) : (
              <input
                className="input"
                type={f.type || 'text'}
                step={f.type === 'number' ? 'any' : undefined}
                min={f.type === 'number' ? 0 : undefined}
                value={values[f.name]}
                required={f.required}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
          </Field>
        ))}
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------ toasts ------------------------------ */
/** Fire-and-forget notifications that work across micro frontends (plain DOM event). */
export const toast = (message, type = 'ok') => window.dispatchEvent(new CustomEvent('flix:toast', { detail: { message, type } }));

export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const onToast = (e) => {
      const t = { id: Math.random(), ...e.detail };
      setItems((x) => [...x, t]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 4000);
    };
    window.addEventListener('flix:toast', onToast);
    return () => window.removeEventListener('flix:toast', onToast);
  }, []);
  return (
    <div className="toasts no-print">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
