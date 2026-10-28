import { useMemo, useState } from 'react';
import { api } from './api';
import { useAsync } from './hooks';
import { Button, Card, DataForm, ErrorBox, Loading, Modal, PageHeader, SearchInput, Table, toast } from './ui';

/**
 * Generic list + create/edit/delete page used for Trainers, Clients and Trainings.
 *
 * props:
 *  title, subtitle, noun        - labels
 *  endpoint                     - e.g. '/trainers'
 *  lookups                      - { clients: '/clients', trainers: '/trainers' } loaded alongside
 *  fields(lookups)              - form field definitions (array or function of the loaded lookups)
 *  columns(lookups)             - table columns (array or function)
 *  searchKeys                   - row keys matched by the search box
 *  filter                       - { key: 'status', options: [{value,label}] } optional dropdown filter
 *  rowActions(row, reload)      - extra buttons rendered in each row
 *  modalWide                    - widen the form modal
 */
export default function MasterPage({ title, subtitle, noun, endpoint, lookups = {}, fields, columns, searchKeys = [], filter, rowActions, modalWide }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState('');
  const [modal, setModal] = useState(null); // null | { row? }

  const { data, loading, error, reload } = useAsync(async () => {
    const entries = await Promise.all(Object.entries(lookups).map(async ([k, url]) => [k, await api.get(url)]));
    return { rows: await api.get(endpoint), lookups: Object.fromEntries(entries) };
  }, [endpoint]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.rows || []).filter(
      (r) =>
        (!needle || searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(needle))) &&
        (!filter || !f || r[filter.key] === f),
    );
  }, [data, q, f]);

  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const lk = data.lookups;
  const formFields = typeof fields === 'function' ? fields(lk) : fields;
  const cols = typeof columns === 'function' ? columns(lk) : columns;

  async function save(values) {
    if (modal.row) await api.put(`${endpoint}/${modal.row.id}`, values);
    else await api.post(endpoint, values);
    toast(`${noun} ${modal.row ? 'updated' : 'added'}`);
    setModal(null);
    reload();
  }
  async function remove(row) {
    if (!window.confirm(`Delete this ${noun.toLowerCase()}?`)) return;
    try {
      await api.del(`${endpoint}/${row.id}`);
      toast(`${noun} deleted`);
      reload();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  const actionCol = {
    header: '',
    render: (r) => (
      <div className="row gap-sm end" onClick={(e) => e.stopPropagation()}>
        {rowActions && rowActions(r, reload)}
        <Button variant="ghost" size="sm" onClick={() => setModal({ row: r })}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" className="danger-text" onClick={() => remove(r)}>
          Delete
        </Button>
      </div>
    ),
  };

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<Button onClick={() => setModal({})}>+ Add {noun.toLowerCase()}</Button>} />
      <Card
        flush
        title={`${rows.length} ${rows.length === 1 ? noun.toLowerCase() : noun.toLowerCase() + 's'}`}
        actions={
          <>
            {filter && (
              <select className="input" value={f} onChange={(e) => setF(e.target.value)}>
                <option value="">All {filter.label || filter.key}</option>
                {filter.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            <SearchInput value={q} onChange={setQ} />
          </>
        }
      >
        <Table columns={[...cols, actionCol]} rows={rows} empty={`No ${noun.toLowerCase()}s found.`} />
      </Card>
      {modal && (
        <Modal title={`${modal.row ? 'Edit' : 'Add'} ${noun.toLowerCase()}`} onClose={() => setModal(null)} wide={modalWide}>
          <DataForm fields={formFields} initial={modal.row || {}} onSubmit={save} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </>
  );
}
