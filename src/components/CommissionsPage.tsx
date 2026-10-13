import { useMemo, useState } from 'react';
import type { PageProps, PayoutBatch } from '../lib/types';
import { getBalances } from '../lib/domain';
import { formatCurrency, formatDate, formatWeight } from '../lib/format';
import { Badge, Button, EmptyState, Icon, Modal } from './ui';

type Tab = 'balances' | 'ledger' | 'batches';
const labels = { accrued: 'Terakumulasi', batched: 'Dalam batch', paid: 'Dibayar', draft: 'Menunggu simulasi' };
const pageSize = 8;
function downloadBatch(batch: PayoutBatch, members: PageProps['data']['members']) {
  const cell = (value: string | number) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""')}"`;
  const rows = [['DEMO — BUKAN INSTRUKSI TRANSFER'], ['Batch', 'Nama mitra', 'Rekening contoh (disamarkan)', 'Nominal IDR', 'Status'], ...batch.items.map(item => [batch.number, members.find(member => member.id === item.memberId)?.name || 'Mitra', item.bankMasked, item.amount, labels[batch.status]])];
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a'); link.href = url; link.download = `DEMO-${batch.number}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CommissionsPage({ data, onAction, onNotify, onNavigate }: PageProps) {
  const [tab, setTab] = useState<Tab>('balances');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [confirmPay, setConfirmPay] = useState(false);
  const balances = useMemo(() => getBalances(data), [data]);
  const eligible = balances.filter(balance => balance.eligible);
  const eligibleTotal = eligible.reduce((sum, balance) => sum + balance.amount, 0);
  const accrued = data.commissions.filter(item => item.status === 'accrued').reduce((sum, item) => sum + item.amount, 0);
  const batched = data.commissions.filter(item => item.status === 'batched').reduce((sum, item) => sum + item.amount, 0);
  const paid = data.commissions.filter(item => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0);
  const selectedBatch = data.batches.find(batch => batch.id === selectedBatchId);
  const search = query.trim().toLocaleLowerCase('id');
  const matches = (value: string) => value.toLocaleLowerCase('id').includes(search);
  const visibleBalances = balances.filter(balance => matches(`${balance.member.name} ${balance.member.referralCode}`) && (filter === 'all' || (filter === 'eligible' ? balance.eligible : filter === 'below' ? balance.amount > 0 && balance.amount < data.settings.payoutThreshold : !balance.eligible && balance.amount >= data.settings.payoutThreshold)));
  const visibleLedger = data.commissions.filter(item => {
    const member = data.members.find(member => member.id === item.memberId);
    const order = data.orders.find(order => order.id === item.orderId);
    return matches(`${member?.name} ${member?.referralCode} ${order?.number || item.orderId}`) && (filter === 'all' || item.status === filter);
  });
  const visibleBatches = data.batches.filter(batch => matches(`${batch.number} ${batch.period}`) && (filter === 'all' || batch.status === filter));
  const count = tab === 'balances' ? visibleBalances.length : tab === 'ledger' ? visibleLedger.length : visibleBatches.length;
  const pages = Math.max(1, Math.ceil(count / pageSize));
  const currentPage = Math.min(page, pages);
  const range = (currentPage - 1) * pageSize;
  const changeTab = (next: Tab) => { setTab(next); setFilter('all'); setQuery(''); setPage(1); };
  const closeBatch = () => { setSelectedBatchId(null); setConfirmPay(false); };

  return <>
    <div className="stat-strip financial-stats">
      <div><span>Komisi terakumulasi</span><strong>{formatCurrency(accrued)}</strong><small>Termasuk saldo di bawah ambang pencairan</small></div>
      <div><span>Siap masuk batch</span><strong>{formatCurrency(eligibleTotal)}</strong><small>{eligible.length} mitra memenuhi syarat</small></div>
      <div><span>Dalam batch</span><strong>{formatCurrency(batched)}</strong><small>Menunggu konfirmasi simulasi</small></div>
      <div><span>Telah dibayar · demo</span><strong>{formatCurrency(paid)}</strong><small>Catatan pembayaran contoh</small></div>
    </div>
    <div className="inline-note"><Icon name="info" size={18} /><span>Cutoff tanggal {data.settings.payoutDay}. Saldo di bawah {formatCurrency(data.settings.payoutThreshold)} tetap terakumulasi dan ditampilkan sebagai ekuivalen gram. Seluruh batch dan pembayaran di sini adalah simulasi.</span></div>
    <section className="panel">
      <div className="panel-heading"><div><h2>Komisi & pencairan</h2><p>Kelola saldo, telusuri transaksi, dan siapkan batch demo.</p></div><Button className="primary" onClick={() => setCreating(true)} disabled={!eligible.length}><Icon name="wallet" size={18} />Buat batch demo</Button></div>
      <div className="page-toolbar">
        <div className="filter-tabs" aria-label="Tampilan komisi">{([['balances', 'Saldo mitra'], ['ledger', 'Ledger komisi'], ['batches', 'Batch pencairan']] as [Tab, string][]).map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => changeTab(key)} aria-pressed={tab === key}>{label}</button>)}</div>
        <label className="search-field"><Icon name="search" size={18} /><input aria-label="Cari komisi" placeholder={tab === 'batches' ? 'Cari nomor batch atau periode...' : 'Cari nama, kode, atau transaksi...'} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} /></label>
        <select aria-label="Filter status komisi" value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }}>
          <option value="all">Semua status</option>
          {tab === 'balances' ? <><option value="eligible">Siap dicairkan</option><option value="below">Di bawah ambang</option><option value="blocked">Belum memenuhi syarat</option></> : tab === 'ledger' ? <><option value="accrued">Terakumulasi</option><option value="batched">Dalam batch</option><option value="paid">Dibayar</option></> : <><option value="draft">Menunggu simulasi</option><option value="paid">Dibayar</option></>}
        </select>
      </div>
      {count === 0 ? <EmptyState icon="wallet" title="Tidak ada catatan yang sesuai" description="Coba nama, nomor, atau status lain." /> : <div className="table-wrap"><table className="data-table">
        {tab === 'balances' ? <><thead><tr><th>Mitra</th><th>Keanggotaan</th><th>Saldo</th><th>Ekuivalen gram</th><th>Status pencairan</th></tr></thead><tbody>{visibleBalances.slice(range, range + pageSize).map(balance => <tr key={balance.member.id}><td><strong>{balance.member.name}</strong><small>{balance.member.referralCode}</small></td><td><Badge tone={balance.member.tier === 'Premium' ? 'gold' : 'neutral'}>{balance.member.tier}</Badge></td><td><strong>{formatCurrency(balance.amount)}</strong></td><td>{formatWeight(balance.grams)}</td><td><Badge tone={balance.eligible ? 'success' : 'neutral'}>{balance.eligible ? 'Siap dicairkan' : 'Terakumulasi'}</Badge><small>{balance.reason}</small></td></tr>)}</tbody></> : tab === 'ledger' ? <><thead><tr><th>Transaksi / mitra</th><th>Tanggal</th><th>Level</th><th>Tarif</th><th>Komisi</th><th>Status</th></tr></thead><tbody>{visibleLedger.slice(range, range + pageSize).map(item => <tr key={item.id}><td><strong>{data.orders.find(order => order.id === item.orderId)?.number || item.orderId}</strong><small>{data.members.find(member => member.id === item.memberId)?.name || 'Mitra'}</small></td><td>{formatDate(item.createdAt)}</td><td>{item.level === 0 ? 'Pembelian sendiri' : `Downline ${item.level}`}</td><td>{item.rate.toLocaleString('id-ID')}%</td><td><strong>{formatCurrency(item.amount)}</strong></td><td><Badge tone={item.status === 'paid' ? 'success' : item.status === 'batched' ? 'gold' : 'neutral'}>{labels[item.status]}</Badge></td></tr>)}</tbody></> : <><thead><tr><th>Nomor batch</th><th>Periode</th><th>Mitra</th><th>Total</th><th>Status</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{visibleBatches.slice(range, range + pageSize).map(batch => <tr key={batch.id}><td><strong>{batch.number}</strong><small>Dibuat {formatDate(batch.createdAt)}</small></td><td>{batch.period}</td><td>{batch.items.length} mitra</td><td><strong>{formatCurrency(batch.total)}</strong></td><td><Badge tone={batch.status === 'paid' ? 'success' : 'gold'}>{labels[batch.status]}</Badge></td><td><Button className="secondary compact" onClick={() => { setSelectedBatchId(batch.id); setConfirmPay(false); }}>Lihat batch<Icon name="arrow" size={15} /></Button></td></tr>)}</tbody></>}
      </table></div>}
      <div className="pagination"><span>{count ? `${range + 1}–${Math.min(range + pageSize, count)} dari ${count} catatan` : '0 catatan'}</span><div><Button className="secondary compact" aria-label="Halaman sebelumnya" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><Icon name="left" size={16} /></Button><span>{currentPage} / {pages}</span><Button className="secondary compact" aria-label="Halaman berikutnya" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}><Icon name="right" size={16} /></Button></div></div>
    </section>
    <button className="text-button" onClick={() => onNavigate('settings')}><Icon name="settings" size={16} />Lihat aturan dan mode komisi</button>
    {creating && <Modal title="Buat batch pencairan demo" subtitle="Saldo yang memenuhi syarat akan dipindahkan ke status dalam batch." onClose={() => setCreating(false)} footer={<><Button className="secondary" onClick={() => setCreating(false)}>Batal</Button><Button className="primary" disabled={!eligible.length} onClick={() => { if (onAction({ type: 'create_batch' })) { setCreating(false); changeTab('batches'); } }}>Buat batch · {eligible.length} mitra</Button></>}>
      <div className="inline-note"><Icon name="info" size={18} /><span>Demo lokal. Tidak mengirim instruksi bank atau memindahkan uang. Rekening contoh disamarkan.</span></div>
      <dl className="definition-list"><div><dt>Mitra memenuhi syarat</dt><dd>{eligible.length} mitra</dd></div><div><dt>Ambang per mitra</dt><dd>{formatCurrency(data.settings.payoutThreshold)}</dd></div><div><dt>Total batch</dt><dd><strong>{formatCurrency(eligibleTotal)}</strong></dd></div></dl>
      <div className="detail-section"><h3>Daftar penerima</h3>{eligible.map(balance => <div className="summary-row" key={balance.member.id}><span>{balance.member.name}<small>{balance.member.bankMasked}</small></span><strong>{formatCurrency(balance.amount)}</strong></div>)}</div>
      <p className="field-hint">Hanya mitra aktif, terverifikasi, dan qualified yang dapat masuk batch. Saldo lain tetap terakumulasi.</p>
    </Modal>}
    {selectedBatch && <Modal title={confirmPay ? 'Konfirmasi pembayaran simulasi' : selectedBatch.number} subtitle={confirmPay ? 'Tindakan ini hanya memperbarui catatan demo.' : `Periode ${selectedBatch.period} · ${selectedBatch.items.length} mitra`} onClose={closeBatch} wide footer={confirmPay ? <><Button className="secondary" onClick={() => setConfirmPay(false)}>Kembali</Button><Button className="primary" onClick={() => { if (onAction({ type: 'pay_batch', id: selectedBatch.id })) { setConfirmPay(false); } }}><Icon name="check" size={17} />Konfirmasi simulasi</Button></> : <><Button className="secondary" onClick={() => { downloadBatch(selectedBatch, data.members); onNotify('CSV demo diunduh. Rekening tetap disamarkan.'); }}><Icon name="download" size={17} />Unduh CSV demo</Button>{selectedBatch.status === 'draft' && <Button className="primary" onClick={() => setConfirmPay(true)}>Simulasikan dibayar</Button>}</>}>
      <div className="inline-note"><Icon name={confirmPay ? 'alert' : 'info'} size={18} /><span>{confirmPay ? `Batch ${selectedBatch.number} sebesar ${formatCurrency(selectedBatch.total)} akan ditandai dibayar pada data demo. Tidak ada transfer atau koneksi bank.` : 'Data contoh untuk tinjauan operasional. CSV bukan berkas instruksi bank.'}</span></div>
      <dl className="definition-list"><div><dt>Status</dt><dd><Badge tone={selectedBatch.status === 'paid' ? 'success' : 'gold'}>{labels[selectedBatch.status]}</Badge></dd></div><div><dt>Total</dt><dd><strong>{formatCurrency(selectedBatch.total)}</strong></dd></div><div><dt>Dibuat</dt><dd>{formatDate(selectedBatch.createdAt)}</dd></div>{selectedBatch.paidAt && <div><dt>Simulasi dibayar</dt><dd>{formatDate(selectedBatch.paidAt)}</dd></div>}</dl>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Mitra</th><th>Rekening contoh</th><th>Nominal</th></tr></thead><tbody>{selectedBatch.items.map(item => <tr key={item.memberId}><td>{data.members.find(member => member.id === item.memberId)?.name || 'Mitra'}</td><td>{item.bankMasked}</td><td><strong>{formatCurrency(item.amount)}</strong></td></tr>)}</tbody></table></div>
    </Modal>}
  </>;
}
