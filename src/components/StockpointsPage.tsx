import { useState } from 'react';
import type { PageProps, Stockpoint } from '../lib/types';
import { formatCurrency, formatDate, formatWeight } from '../lib/format';
import { Badge, Button, EmptyState, Icon, Modal } from './ui';

const skuWeights = [0.5, 1, 5, 10];
const inventoryLabels = { available: 'Tersedia', reserved: 'Direservasi', released: 'Diserahkan' };
const statusLabels = { pending: 'Menunggu bayar', ready: 'Siap diambil', done: 'Selesai', cancelled: 'Dibatalkan' };
function reconciledToday(stockpoint: Stockpoint, today: string) { return stockpoint.lastReconciledAt !== null && formatDate(stockpoint.lastReconciledAt) === formatDate(today); }

export default function StockpointsPage(props: PageProps) {
  const { data } = props;
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cities = [...new Set(data.stockpoints.map(stockpoint => stockpoint.city))].sort();
  const search = query.trim().toLocaleLowerCase('id');
  const stockpoints = data.stockpoints.filter(stockpoint => (city === 'all' || stockpoint.city === city) && (status === 'all' || stockpoint.status === status) && `${stockpoint.name} ${stockpoint.city} ${stockpoint.staffName}`.toLocaleLowerCase('id').includes(search));
  const selected = data.stockpoints.find(stockpoint => stockpoint.id === selectedId);
  return <>
    <div className="stat-strip"><div><span>Stockpoint aktif</span><strong>{data.stockpoints.filter(stockpoint => stockpoint.status === 'active').length}<small> / {data.stockpoints.length} lokasi</small></strong></div><div><span>Batang tersedia</span><strong>{data.inventory.filter(unit => unit.state === 'available').length}<small> batang</small></strong></div><div><span>Pesanan siap diambil</span><strong>{data.orders.filter(order => order.status === 'ready').length}<small> pesanan</small></strong></div><div><span>Rekonsiliasi hari ini</span><strong>{data.stockpoints.filter(stockpoint => reconciledToday(stockpoint, data.today)).length}<small> lokasi</small></strong></div></div>
    <div className="page-toolbar"><label className="search-field"><Icon name="search" size={18} /><input aria-label="Cari stockpoint" placeholder="Cari lokasi atau nama penanggung jawab..." value={query} onChange={event => setQuery(event.target.value)} /></label><select aria-label="Filter kota" value={city} onChange={event => setCity(event.target.value)}><option value="all">Semua kota</option>{cities.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filter status stockpoint" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Semua status</option><option value="active">Aktif</option><option value="paused">Dijeda</option></select><span className="muted">{stockpoints.length} lokasi</span></div>
    {stockpoints.length === 0 ? <section className="panel"><EmptyState icon="warehouse" title="Stockpoint tidak ditemukan" description="Sesuaikan kota, status, atau kata pencarian." /></section> : <div className="stockpoint-grid">{stockpoints.map(stockpoint => {
      const units = data.inventory.filter(unit => unit.stockpointId === stockpoint.id);
      const ready = data.orders.filter(order => order.stockpointId === stockpoint.id && order.status === 'ready');
      const openExceptions = data.exceptions.filter(exception => exception.stockpointId === stockpoint.id && exception.status !== 'resolved').length;
      const reconciled = reconciledToday(stockpoint, data.today);
      return <section className="panel stockpoint-card" key={stockpoint.id}>
        <div className="stockpoint-card-top"><span className="stockpoint-icon"><Icon name="warehouse" size={23} /></span><Badge tone={stockpoint.status === 'active' ? 'success' : 'neutral'}>{stockpoint.status === 'active' ? 'Aktif' : 'Dijeda'}</Badge></div>
        <h2>{stockpoint.name}</h2><p className="stockpoint-meta"><Icon name="pin" size={15} />{stockpoint.city}</p><p>{stockpoint.address}</p>
        <div className="stockpoint-numbers"><div><strong>{units.filter(unit => unit.state === 'available').length}</strong><span>Batang tersedia</span></div><div><strong>{ready.length}</strong><span>Siap diambil</span></div><div><strong>{openExceptions}</strong><span>Kendala terbuka</span></div></div>
        <div className="stockpoint-meta"><Icon name="user" size={16} /><span>{stockpoint.staffName}</span></div>
        <div className="stockpoint-card-footer"><Badge tone={reconciled ? 'success' : 'gold'}>{reconciled ? 'Rekonsiliasi selesai' : 'Perlu rekonsiliasi'}</Badge><Button className="secondary compact" onClick={() => setSelectedId(stockpoint.id)} aria-label={`Detail ${stockpoint.name}`}>Detail<Icon name="arrow" size={16} /></Button></div>
      </section>;
    })}</div>}
    <div className="inline-note"><Icon name="info" size={18} /><span>Persediaan, serial, dan rekonsiliasi ditampilkan untuk pemantauan. Perubahan status lokasi di sini hanya berlaku pada data demo.</span></div>
    {selected && <StockpointDetail key={selected.id} {...props} stockpoint={selected} onClose={() => setSelectedId(null)} />}
  </>;
}

function StockpointDetail({ stockpoint, data, onAction, onClose, onNavigate }: PageProps & { stockpoint: Stockpoint; onClose: () => void }) {
  const [tab, setTab] = useState<'summary' | 'serials'>('summary');
  const [serialQuery, setSerialQuery] = useState('');
  const [serialStatus, setSerialStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [editingStatus, setEditingStatus] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const units = data.inventory.filter(unit => unit.stockpointId === stockpoint.id);
  const orders = data.orders.filter(order => order.stockpointId === stockpoint.id && order.status === 'ready');
  const exceptions = data.exceptions.filter(exception => exception.stockpointId === stockpoint.id && exception.status !== 'resolved');
  const serials = units.filter(unit => unit.serial.toLocaleLowerCase('id').includes(serialQuery.trim().toLocaleLowerCase('id')) && (serialStatus === 'all' || unit.state === serialStatus));
  const pages = Math.max(1, Math.ceil(serials.length / 8));
  const currentPage = Math.min(page, pages);
  const nextStatus = stockpoint.status === 'active' ? 'paused' : 'active';
  const submitStatus = () => {
    if (note.trim().length < 10) { setError('Tulis alasan minimal 10 karakter.'); return; }
    if (onAction({ type: 'set_stockpoint_status', id: stockpoint.id, status: nextStatus, note: note.trim() })) { setEditingStatus(false); setNote(''); setError(''); }
  };
  return <Modal title={stockpoint.name} subtitle={`${stockpoint.city} · ${stockpoint.staffName}`} onClose={onClose} wide footer={editingStatus ? <><Button className="secondary" onClick={() => { setEditingStatus(false); setError(''); }}>Batal</Button><Button className="primary" onClick={submitStatus}>{nextStatus === 'paused' ? 'Jeda lokasi demo' : 'Aktifkan lokasi demo'}</Button></> : <><Button className="secondary" onClick={onClose}>Tutup</Button><Button className="secondary" onClick={() => setEditingStatus(true)}><Icon name={nextStatus === 'paused' ? 'clock' : 'check'} size={17} />{nextStatus === 'paused' ? 'Jeda lokasi' : 'Aktifkan lokasi'}</Button></>}>
    {editingStatus ? <div className="form-stack"><div className="inline-note"><Icon name="info" size={18} /><span>{nextStatus === 'paused' ? 'Status lokasi akan dijeda dalam demo. Pesanan dan serial yang ada tetap tercatat.' : 'Lokasi akan kembali berstatus aktif dalam demo.'} Alasan perubahan dicatat pada log audit.</span></div><label className="form-field"><span>Alasan perubahan</span><textarea rows={4} value={note} onChange={event => { setNote(event.target.value); setError(''); }} placeholder="Jelaskan alasan perubahan status lokasi..." aria-describedby="stockpoint-note-hint" /></label><p className="field-hint" id="stockpoint-note-hint">Minimal 10 karakter.</p>{error && <p className="field-error" role="alert">{error}</p>}</div> : <>
      <dl className="definition-list"><div><dt>Status lokasi</dt><dd><Badge tone={stockpoint.status === 'active' ? 'success' : 'neutral'}>{stockpoint.status === 'active' ? 'Aktif' : 'Dijeda'}</Badge></dd></div><div><dt>Alamat</dt><dd>{stockpoint.address}</dd></div><div><dt>Rekonsiliasi terakhir</dt><dd>{stockpoint.lastReconciledAt ? formatDate(stockpoint.lastReconciledAt, { hour: '2-digit', minute: '2-digit' }) : 'Belum tercatat'}</dd></div><div><dt>Status harian</dt><dd><Badge tone={reconciledToday(stockpoint, data.today) ? 'success' : 'gold'}>{reconciledToday(stockpoint, data.today) ? 'Sudah rekonsiliasi' : 'Belum rekonsiliasi hari ini'}</Badge></dd></div></dl>
      <div className="filter-tabs stockpoint-detail-tabs"><button className={tab === 'summary' ? 'active' : ''} aria-pressed={tab === 'summary'} onClick={() => setTab('summary')}>Ringkasan lokasi</button><button className={tab === 'serials' ? 'active' : ''} aria-pressed={tab === 'serials'} onClick={() => setTab('serials')}>Daftar serial · {units.length}</button></div>
      {tab === 'summary' ? <>
        <div className="detail-section"><h3>Persediaan per produk</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Produk</th><th>Tersedia</th><th>Direservasi</th><th>Diserahkan</th></tr></thead><tbody>{skuWeights.map(grams => <tr key={grams}><td><strong>WARIS {formatWeight(grams)}</strong></td><td>{units.filter(unit => unit.grams === grams && unit.state === 'available').length}</td><td>{units.filter(unit => unit.grams === grams && unit.state === 'reserved').length}</td><td>{units.filter(unit => unit.grams === grams && unit.state === 'released').length}</td></tr>)}</tbody></table></div></div>
        <div className="detail-section"><h3>Pesanan siap diambil · {orders.length}</h3>{orders.length === 0 ? <p className="muted">Tidak ada pesanan yang menunggu pengambilan.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Produk</th><th>Total</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td><strong>{order.number}</strong><small>{statusLabels[order.status]}</small></td><td>{data.members.find(member => member.id === order.memberId)?.name || 'Pelanggan'}</td><td>{order.quantity} × {formatWeight(order.grams)}</td><td>{formatCurrency(order.total)}</td></tr>)}</tbody></table></div>}</div>
        {exceptions.length > 0 && <div className="inline-note"><Icon name="alert" size={18} /><span>{exceptions.length} kendala belum selesai pada lokasi ini.</span><button className="text-button" onClick={() => { onClose(); onNavigate('exceptions'); }}>Lihat kendala<Icon name="arrow" size={15} /></button></div>}
      </> : <><div className="page-toolbar"><label className="search-field"><Icon name="search" size={17} /><input aria-label="Cari serial di lokasi" placeholder="Cari nomor serial..." value={serialQuery} onChange={event => { setSerialQuery(event.target.value); setPage(1); }} /></label><select aria-label="Filter status serial" value={serialStatus} onChange={event => { setSerialStatus(event.target.value); setPage(1); }}><option value="all">Semua status</option>{Object.entries(inventoryLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></div>{serials.length === 0 ? <EmptyState icon="package" title="Serial tidak ditemukan" /> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Serial</th><th>Produk</th><th>Status</th><th>Pesanan</th></tr></thead><tbody>{serials.slice((currentPage - 1) * 8, currentPage * 8).map(unit => <tr key={unit.serial}><td><strong>{unit.serial}</strong></td><td>{formatWeight(unit.grams)}</td><td><Badge tone={unit.state === 'available' ? 'success' : unit.state === 'reserved' ? 'gold' : 'neutral'}>{inventoryLabels[unit.state]}</Badge></td><td>{data.orders.find(order => order.id === unit.orderId)?.number || '—'}</td></tr>)}</tbody></table></div>}<div className="pagination"><span>{serials.length} serial · {currentPage} / {pages}</span><div><Button className="secondary compact" disabled={currentPage === 1} aria-label="Serial sebelumnya" onClick={() => setPage(currentPage - 1)}><Icon name="left" size={16} /></Button><Button className="secondary compact" disabled={currentPage === pages} aria-label="Serial berikutnya" onClick={() => setPage(currentPage + 1)}><Icon name="right" size={16} /></Button></div></div></>}
    </>}
  </Modal>;
}
