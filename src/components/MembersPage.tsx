import { useMemo, useState } from 'react';
import type { Member, PageProps, Tier, Verification } from '../lib/types';
import { formatDate, formatWeight } from '../lib/format';
import { Badge, Button, EmptyState, Icon, Modal } from './ui';

const verificationLabels: Record<Verification, string> = { pending: 'Menunggu review', verified: 'Terverifikasi', rejected: 'Ditolak' };
function VerificationBadge({ value }: { value: Verification }) { return <Badge tone={value === 'verified' ? 'success' : value === 'pending' ? 'gold' : 'red'}>{verificationLabels[value]}</Badge>; }

export default function MembersPage({ data, onAction }: PageProps) {
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [verification, setVerification] = useState<Verification | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operation, setOperation] = useState<'review' | 'status' | null>(null);
  const [decision, setDecision] = useState<'verified' | 'rejected'>('verified');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const filtered = useMemo(() => data.members.filter(member => (tier === 'all' || member.tier === tier) && (verification === 'all' || member.verification === verification) && `${member.name} ${member.referralCode} ${member.region} ${member.phoneMasked}`.toLowerCase().includes(query.trim().toLowerCase())), [data.members, query, tier, verification]);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const selected = data.members.find(member => member.id === selectedId);
  const referrer = data.members.find(member => member.id === selected?.referrerId);
  function open(member: Member) { setSelectedId(member.id); setOperation(null); setNote(''); setError(''); setDecision('verified'); }
  function submit() {
    if (!selected || !operation) return;
    if ((operation === 'status' || decision === 'rejected') && note.trim().length < 10) { setError('Tulis alasan setidaknya 10 karakter agar perubahan dapat ditelusuri.'); return; }
    const succeeded = operation === 'review'
      ? onAction({ type: 'review_member', id: selected.id, decision, note: note.trim() })
      : onAction({ type: 'set_member_status', id: selected.id, status: selected.status === 'active' ? 'suspended' : 'active', note: note.trim() });
    if (succeeded) { setSelectedId(null); setOperation(null); }
  }
  return <>
    <div className="stat-strip"><div><span>Total anggota</span><strong>{data.members.length}</strong></div><div><span>Menunggu review</span><strong>{data.members.filter(member => member.verification === 'pending').length}</strong></div><div><span>Mitra qualified</span><strong>{data.members.filter(member => member.tier !== 'Registered' && member.status === 'active' && member.verification === 'verified').length}</strong></div></div>
    <section className="panel">
      <div className="page-toolbar"><label className="search-field"><Icon name="search" size={18} /><input aria-label="Cari anggota" value={query} placeholder="Cari nama, kode referral, atau wilayah" onChange={event => { setQuery(event.target.value); setPage(1); }} /></label><label className="form-field"><span>Keanggotaan</span><select value={tier} onChange={event => { setTier(event.target.value as Tier | 'all'); setPage(1); }}><option value="all">Semua tier</option><option>Registered</option><option>Classic</option><option>Premium</option></select></label><label className="form-field"><span>Verifikasi</span><select value={verification} onChange={event => { setVerification(event.target.value as Verification | 'all'); setPage(1); }}><option value="all">Semua verifikasi</option><option value="pending">Menunggu review</option><option value="verified">Terverifikasi</option><option value="rejected">Ditolak</option></select></label></div>
      {visible.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Anggota</th><th>Tier</th><th>Kode referral</th><th>Verifikasi</th><th>Status</th><th>Bergabung</th><th /></tr></thead><tbody>{visible.map(member => <tr key={member.id}><td><strong>{member.name}</strong><small>{member.region} · {member.phoneMasked}</small></td><td><Badge tone={member.tier === 'Premium' ? 'gold' : 'neutral'}>{member.tier}</Badge></td><td><code>{member.referralCode}</code></td><td><VerificationBadge value={member.verification} /></td><td><Badge tone={member.status === 'active' ? 'success' : 'red'}>{member.status === 'active' ? 'Aktif' : 'Ditangguhkan'}</Badge></td><td>{formatDate(member.joinedAt)}</td><td><Button className="button-ghost button-small" onClick={() => open(member)} aria-label={`Detail anggota ${member.name}`}>Detail <Icon name="arrow" size={15} /></Button></td></tr>)}</tbody></table></div> : <EmptyState icon="users" title="Anggota tidak ditemukan" description="Coba kata kunci atau filter yang berbeda." />}
      <div className="pagination"><span>{filtered.length} anggota · Halaman {currentPage} dari {pages}</span><div><Button className="button-secondary button-small" disabled={currentPage <= 1} aria-label="Halaman anggota sebelumnya" onClick={() => setPage(currentPage - 1)}><Icon name="left" size={16} /></Button><Button className="button-secondary button-small" disabled={currentPage >= pages} aria-label="Halaman anggota berikutnya" onClick={() => setPage(currentPage + 1)}><Icon name="right" size={16} /></Button></div></div>
    </section>
    {selected && <Modal wide title={selected.name} subtitle={`Anggota ${selected.id} · ${selected.region}`} onClose={() => setSelectedId(null)} footer={operation ? <><Button className="button-secondary" onClick={() => { setOperation(null); setError(''); }}>Batal</Button><Button onClick={submit}>{operation === 'review' ? decision === 'verified' ? 'Setujui verifikasi' : 'Tolak verifikasi' : selected.status === 'active' ? 'Tangguhkan anggota' : 'Aktifkan anggota'}</Button></> : <><Button className="button-secondary" onClick={() => { setOperation('status'); setNote(''); setError(''); }}>{selected.status === 'active' ? 'Tangguhkan anggota' : 'Aktifkan kembali'}</Button>{selected.verification === 'pending' && <Button onClick={() => { setOperation('review'); setNote(''); setError(''); }}>Review verifikasi <Icon name="shield" size={17} /></Button>}</>}>
      <div className="member-summary"><span className="member-avatar">{selected.name.split(' ').slice(0, 2).map(part => part[0]).join('')}</span><div><h3>{selected.name}</h3><div className="badge-row"><Badge tone={selected.tier === 'Premium' ? 'gold' : 'neutral'}>{selected.tier}</Badge><VerificationBadge value={selected.verification} /><Badge tone={selected.status === 'active' ? 'success' : 'red'}>{selected.status === 'active' ? 'Aktif' : 'Ditangguhkan'}</Badge></div></div></div>
      <div className="detail-grid"><dl className="definition-list"><div><dt>Nomor WhatsApp</dt><dd>{selected.phoneMasked}</dd></div><div><dt>Kode referral</dt><dd>{selected.referralCode}</dd></div><div><dt>Direferensikan oleh</dt><dd>{referrer?.name || 'Pendaftaran langsung'}</dd></div><div><dt>Rekening pencairan</dt><dd>{selected.bankMasked}</dd></div></dl><dl className="definition-list"><div><dt>Tanggal bergabung</dt><dd>{formatDate(selected.joinedAt)}</dd></div><div><dt>Pembelian kualifikasi</dt><dd>{formatWeight(selected.qualifyingGrams)}</dd></div><div><dt>Pembelian terakhir</dt><dd>{selected.lastPurchaseAt ? formatDate(selected.lastPurchaseAt) : 'Belum ada'}</dd></div><div><dt>Mitra langsung</dt><dd>{data.members.filter(member => member.referrerId === selected.id).length} anggota</dd></div></dl></div>
      <div className="document-preview"><Icon name="id" size={30} /><div><strong>Dokumen identitas & selfie — simulasi</strong><p>Data verifikasi sintetis untuk demo. Dokumen pribadi tidak diunggah atau disimpan.</p></div><Badge tone="neutral">DEMO</Badge></div>
      {selected.reviewNote && <div className="inline-note"><Icon name="info" size={18} /><p><strong>Catatan terakhir</strong><br />{selected.reviewNote}</p></div>}
      {operation && <div className="form-stack"><h3>{operation === 'review' ? 'Keputusan verifikasi' : selected.status === 'active' ? 'Tangguhkan keanggotaan' : 'Aktifkan keanggotaan'}</h3>{operation === 'review' && <label className="form-field"><span>Hasil review</span><select value={decision} onChange={event => { setDecision(event.target.value as 'verified' | 'rejected'); setError(''); }}><option value="verified">Setujui · dokumen sesuai</option><option value="rejected">Tolak · perlu perbaikan</option></select></label>}<label className="form-field"><span>{operation === 'review' && decision === 'verified' ? 'Catatan review (opsional)' : 'Alasan perubahan (minimal 10 karakter)'}</span><textarea rows={3} value={note} placeholder="Tuliskan alasan yang jelas untuk catatan audit" onChange={event => { setNote(event.target.value); setError(''); }} /></label>{operation === 'status' && <p className="muted">Perubahan status berlaku pada simulasi ini dan dicatat dalam audit log.</p>}{error && <p className="form-error" role="alert">{error}</p>}</div>}
    </Modal>}
  </>;
}
