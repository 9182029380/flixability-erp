/** Letterhead used on printable Purchase Orders and Invoices. */
export default function CompanyHeader({ company, title, children }) {
  return (
    <div className="doc-head">
      <div>
        <h2 style={{ marginBottom: 4 }}>{company?.name}</h2>
        <div className="muted">
          {company?.address}
          <br />
          GSTIN: {company?.gstin} · PAN: {company?.pan}
          <br />
          {company?.email} · {company?.phone}
        </div>
      </div>
      <div>
        <div className="doc-title">{title}</div>
        <div style={{ textAlign: 'right' }}>{children}</div>
      </div>
    </div>
  );
}
