import { useState } from 'react';
import type { ExceptionRecord, PageProps } from '../lib/types';
import { formatDate } from '../lib/format';
import { Badge, Button, EmptyState, Icon, Modal } from './ui';

const categoryLabels = { identity: 'Identitas', serial: 'Serial emas', stock: 'Persediaan', cash: 'Kas & pembayaran' };
const statusLabels = { open: 'Terbuka', reviewing: 'Dalam tinjauan', resolved: 'Selesai' };
const pageSize = 8;
export default function ExceptionsPage(props: PageProps) {
  const { data } = props;
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const search = query.trim().toLocaleLowerCase('id');
  const filtered = data.exceptions.filter(item => (status === 'all' || item.status === status) && (category === 'all' || item.category === category) && `${item.number} ${item.reference} ${item.note} ${data.stockpoints.find(stockpoint => stockpoint.id === item.stockpointId)?.name || ''}`.toLocaleLowerCase('id').includes(search));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const range = (currentPage - 1) * pageSize;
  const selected = data.exceptions.find(item => item.id === selectedId);
  return <>
    <div className="stat-strip"><div><span>Perlu ditindaklanjuti</span><strong>{data.exceptions.filter(item => item.status === 'open').length}<small> kendala terbuka</small></strong></div><div><span>Dalam tinjauan</span><strong>{data.exceptions.filter(item => item.status === 'reviewing').length}<small> ditangani tim</small></strong></div><div><span>Prioritas tinggi</span><strong>{data.exceptions.filter(item => item.priority === 'high' && item.status !== 'resolved').length}<small> belum selesai</small></strong></div><div><span>Diselesaikan</span><strong>{data.exceptions.filter(item => item.status === 'resolved').length}<small> kendala</small></strong></div></div>
    <section className="panel"><div className="panel-heading"><div><h2>Antrean kendala operasional</h2><p>Tindak lanjut laporan stockpoint dan catat penyelesaiannya.</p></div><Badge tone="gold">{data.exceptions.filter(item => item.status !== 'resolved').length} belum selesai</Badge></div>
      <div className="page-toolbar"><div className="filter-tabs" aria-label="Status kendala">{([['all', 'Semua'], ['open', 'Terbuka'], ['reviewing', 'Dalam tinjauan'], ['resolved', 'Selesai']] as const).map(([value, label]) => <button key={value} className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}</div><label className="search-field"><Icon name="search" size={18} /><input aria-label="Cari kendala" placeholder="Cari laporan, referensi, atau stockpoint..." value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><select aria-label="Filter kategori kendala" value={category} onChange={event => { setCategory(event.target.value); setPage(1); }}><option value="all">Semua kategori</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {filtered.length === 0 ? <EmptyState icon="checks" title="Tidak ada kendala yang sesuai" description="Coba status, kategori, atau kata pencarian lain." /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Laporan / referensi</th><th>Stockpoint</th><th>Kategori</th><th>Prioritas</th><th>Penanggung jawab</th><th>Status</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{filtered.slice(range, range + pageSize).map(item => <tr key={item.id}><td><strong>{item.number}</strong><small>{item.reference}</small><small>{formatDate(item.createdAt)}</small></td><td>{data.stockpoints.find(stockpoint => stockpoint.id === item.stockpointId)?.name || '—'}</td><td>{categoryLabels[item.category]}</td><td><Badge tone={item.priority === 'high' ? 'red' : 'neutral'}>{item.priority === 'high' ? 'Tinggi' : 'Normal'}</Badge></td><td>{item.assignee}</td><td><Badge tone={item.status === 'resolved' ? 'success' : item.status === 'reviewing' ? 'gold' : 'neutral'}>{statusLabels[item.status]}</Badge></td><td><Button className="secondary compact" aria-label={`Tinjau ${item.number}`} onClick={() => setSelectedId(item.id)}>{item.status === 'resolved' ? 'Detail' : 'Tinjau'}<Icon name="arrow" size={15} /></Button></td></tr>)}</tbody></table></div>}
      <div className="pagination"><span>{filtered.length ? `${range + 1}–${Math.min(range + pageSize, filtered.length)} dari ${filtered.length} laporan` : '0 laporan'}</span><div><Button className="secondary compact" disabled={currentPage === 1} aria-label="Halaman sebelumnya" onClick={() => setPage(currentPage - 1)}><Icon name="left" size={16} /></Button><span>{currentPage} / {pages}</span><Button className="secondary compact" disabled={currentPage === pages} aria-label="Halaman berikutnya" onClick={() => setPage(currentPage + 1)}><Icon name="right" size={16} /></Button></div></div>
    </section>
    <div className="inline-note"><Icon name="shield" size={18} /><span>Setiap perubahan penanggung jawab dan penyelesaian dicatat dalam log audit demo.</span></div>
    {selected && <ExceptionDetail key={selected.id} {...props} item={selected} onClose={() => setSelectedId(null)} />}
  </>;
}

function ExceptionDetail({ item, data, onAction, onClose }: PageProps & { item: ExceptionRecord; onClose: () => void }) {
  const [assignee, setAssignee] = useState<ExceptionRecord['assignee']>(item.assignee);
  const [resolution, setResolution] = useState(item.resolution || '');
  const [error, setError] = useState('');
  const resolved = item.status === 'resolved';
  const save = (nextStatus: 'reviewing' | 'resolved') => {
    if (nextStatus === 'resolved' && resolution.trim().length < 10) { setError('Jelaskan penyelesaian minimal 10 karakter.'); return; }
    if (onAction({ type: 'update_exception', id: item.id, status: nextStatus, assignee, resolution: resolution.trim() })) onClose();
  };
  return <Modal title={item.number} subtitle={`${categoryLabels[item.category]} · ${item.reference}`} onClose={onClose} footer={resolved ? <Button className="secondary" onClick={onClose}>Tutup</Button> : <><Button className="secondary" disabled={item.status === 'reviewing' && assignee === item.assignee} onClick={() => save('reviewing')}>{item.status === 'open' ? 'Mulai tinjauan' : 'Simpan penugasan'}</Button><Button className="primary" onClick={() => save('resolved')}><Icon name="check" size={17} />Selesaikan kendala</Button></>}>
    <dl className="definition-list"><div><dt>Stockpoint</dt><dd>{data.stockpoints.find(stockpoint => stockpoint.id === item.stockpointId)?.name || '—'}</dd></div><div><dt>Dilaporkan</dt><dd>{formatDate(item.createdAt, { hour: '2-digit', minute: '2-digit' })}</dd></div><div><dt>Prioritas</dt><dd><Badge tone={item.priority === 'high' ? 'red' : 'neutral'}>{item.priority === 'high' ? 'Tinggi' : 'Normal'}</Badge></dd></div><div><dt>Status</dt><dd><Badge tone={resolved ? 'success' : item.status === 'reviewing' ? 'gold' : 'neutral'}>{statusLabels[item.status]}</Badge></dd></div></dl>
    <div className="detail-section"><h3>Catatan laporan</h3><p className="exception-note">{item.note}</p></div>
    {resolved ? <><dl className="definition-list"><div><dt>Penanggung jawab</dt><dd>{item.assignee}</dd></div><div><dt>Diselesaikan</dt><dd>{item.resolvedAt ? formatDate(item.resolvedAt, { hour: '2-digit', minute: '2-digit' }) : '—'}</dd></div></dl><div className="detail-section"><h3>Catatan penyelesaian</h3><p className="exception-note">{item.resolution || '—'}</p></div></> : <div className="form-stack"><label className="form-field"><span>Penanggung jawab</span><select value={assignee} onChange={event => setAssignee(event.target.value as ExceptionRecord['assignee'])}><option value="JV Ops">JV Ops</option><option value="SGI Finance">SGI Finance</option></select></label><label className="form-field"><span>Catatan penyelesaian</span><textarea rows={4} value={resolution} onChange={event => { setResolution(event.target.value); setError(''); }} placeholder="Jelaskan hasil pemeriksaan dan tindakan penyelesaian..." aria-describedby="resolution-hint" /></label><p className="field-hint" id="resolution-hint">Wajib minimal 10 karakter untuk menyelesaikan kendala.</p>{error && <p className="field-error" role="alert">{error}</p>}</div>}
  </Modal>;
}
