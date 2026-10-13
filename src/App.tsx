import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminAction, Page, PageProps } from './lib/types';
import { createDemoData } from './lib/demo';
import { applyAction } from './lib/domain';
import { formatDate } from './lib/format';
import { Button, Icon, Modal } from './components/ui';
import OverviewPage from './components/OverviewPage';
import MembersPage from './components/MembersPage';
import OrdersPage from './components/OrdersPage';
import CommissionsPage from './components/CommissionsPage';
import StockpointsPage from './components/StockpointsPage';
import ExceptionsPage from './components/ExceptionsPage';
import AuditPage from './components/AuditPage';
import SettingsPage from './components/SettingsPage';

const navigation: { id: Page; label: string; icon: string; description: string; path: string }[] = [
  { id: 'overview', label: 'Ringkasan', icon: 'overview', description: 'Lihat perkembangan program dan hal yang perlu ditindaklanjuti.', path: '/' },
  { id: 'members', label: 'Anggota & mitra', icon: 'users', description: 'Kelola verifikasi, keanggotaan, dan hubungan referral.', path: '/members' },
  { id: 'orders', label: 'Transaksi', icon: 'receipt', description: 'Telusuri pesanan, pembayaran, dan penyerahan emas.', path: '/orders' },
  { id: 'commissions', label: 'Komisi & payout', icon: 'wallet', description: 'Periksa komisi penjualan dan siapkan batch pencairan.', path: '/commissions' },
  { id: 'stockpoints', label: 'Stockpoint', icon: 'building', description: 'Pantau layanan dan persediaan di seluruh jaringan lokasi.', path: '/stockpoints' },
  { id: 'exceptions', label: 'Kendala operasional', icon: 'alert', description: 'Tindak lanjuti temuan dari stockpoint sampai selesai.', path: '/exceptions' },
  { id: 'audit', label: 'Riwayat audit', icon: 'shield', description: 'Setiap perubahan memiliki catatan yang bisa ditelusuri.', path: '/audit' },
  { id: 'settings', label: 'Pengaturan', icon: 'settings', description: 'Atur skema komisi dan penugasan staf pada demo ini.', path: '/settings' },
];
const components = { overview: OverviewPage, members: MembersPage, orders: OrdersPage, commissions: CommissionsPage, stockpoints: StockpointsPage, exceptions: ExceptionsPage, audit: AuditPage, settings: SettingsPage };
const currentPage = (): Page => navigation.find(item => item.path === window.location.pathname)?.id || 'overview';

export default function App() {
  const [data, setData] = useState(createDemoData);
  const dataRef = useRef(data);
  const [page, setPage] = useState<Page>(currentPage);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [help, setHelp] = useState(false);
  const [session, setSession] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const navButton = useRef<HTMLButtonElement>(null);
  const notify = useCallback((message: string) => setToast({ message, error: false }), []);
  const onAction = useCallback((action: AdminAction) => {
    try {
      const next = applyAction(dataRef.current, action);
      dataRef.current = next;
      setData(next);
      setToast({ message: 'Perubahan demo tersimpan dan tercatat di riwayat audit.', error: false });
      return true;
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Perubahan belum dapat disimpan.', error: true });
      return false;
    }
  }, []);
  const navigate = useCallback((next: Page) => {
    setPage(next);
    setDrawer(false);
    if (location.pathname !== navigation.find(item => item.id === next)!.path) history.pushState({}, '', navigation.find(item => item.id === next)!.path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  useEffect(() => {
    const listener = () => { setPage(currentPage()); setDrawer(false); };
    window.addEventListener('popstate', listener);
    return () => window.removeEventListener('popstate', listener);
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 6000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!drawer) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('.drawer-close')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawer(false);
      if (event.key !== 'Tab') return;
      const nodes = [...(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href], button') || [])].filter(node => node.offsetParent !== null);
      if (event.shiftKey && document.activeElement === nodes[0]) { event.preventDefault(); nodes.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === nodes.at(-1)) { event.preventDefault(); nodes[0]?.focus(); }
    };
    const resize = () => { if (window.innerWidth > 760) setDrawer(false); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('resize', resize);
    return () => { document.body.style.overflow = oldOverflow; window.removeEventListener('keydown', keydown); window.removeEventListener('resize', resize); navButton.current?.focus(); };
  }, [drawer]);

  const current = navigation.find(item => item.id === page)!;
  const PageComponent = components[page];
  const pageProps: PageProps = { data, onAction, onNotify: notify, onNavigate: navigate };
  const pending = data.members.filter(member => member.verification === 'pending').length;
  const exceptions = data.exceptions.filter(item => item.status !== 'resolved').length;
  const initials = data.actor.split(' ').map(word => word[0]).slice(0, 2).join('');

  return <div className="console-app admin-app">
    <a className="skip-link" href="#main-content">Langsung ke konten</a>
    {drawer && <div className="sidebar-scrim" onClick={() => setDrawer(false)} />}
    <aside className={`sidebar ${drawer ? 'is-open' : ''}`} id="admin-navigation" ref={sidebarRef}>
      <a className="brand" href="/" onClick={event => { event.preventDefault(); navigate('overview'); }}><span className="brand-symbol"><Icon name="gold" size={25} /></span><span><strong>SAMPOERNA GOLD</strong><small>ADMIN CONSOLE</small></span></a>
      <button className="drawer-close icon-button" aria-label="Tutup navigasi" onClick={() => setDrawer(false)}><Icon name="close" size={18} /></button>
      <span className="nav-label">OPERASIONAL</span>
      <nav aria-label="Navigasi utama">{navigation.map((item, index) => <div key={item.id}>{index === 6 && <span className="nav-label governance-label">TATA KELOLA</span>}<a href={item.path} aria-current={page === item.id ? 'page' : undefined} className={page === item.id ? 'active' : ''} onClick={event => { event.preventDefault(); navigate(item.id); }}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.id === 'members' && pending > 0 && <b>{pending}</b>}{item.id === 'exceptions' && exceptions > 0 && <b>{exceptions}</b>}</a></div>)}</nav>
      <div className="sidebar-bottom"><button className="guide-button" onClick={() => { setHelp(true); setDrawer(false); }}><span className="guide-icon"><Icon name="help" size={21} /></span><span><strong>Panduan admin</strong><small>Kenali alur operasional</small></span><Icon name="right" size={14} /></button><button className="sidebar-staff staff-session" onClick={() => { setSession(true); setDrawer(false); }}><span className="avatar">{initials}</span><span><strong>{data.actor}</strong><small>Administrator · Demo</small></span><Icon name="settings" size={16} /></button><p>Powered by <b>Newtn Technology</b></p></div>
    </aside>
    <div className="workspace" inert={drawer ? true : undefined}>
      <header className="topbar"><div className="topbar-left"><button ref={navButton} className="icon-button mobile-menu" aria-label="Buka navigasi" aria-controls="admin-navigation" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu" size={20} /></button><span className="breadcrumb"><span className="breadcrumb-parent">Workspace</span><Icon name="right" size={12} /><strong>{current.label}</strong></span></div><div className="topbar-actions"><span className="demo-badge"><i />DEMO</span><span className="admin-scope"><Icon name="building" size={16} />Seluruh jaringan</span><button className="header-avatar" aria-label="Informasi sesi demo" onClick={() => setSession(true)}>{initials}</button></div></header>
      <main id="main-content"><div className="page-heading"><div><p className="eyebrow">SAMPOERNA GOLD · PARTNER OPERATIONS</p><h1>{current.label}</h1><p>{current.description}</p></div><span className="today"><Icon name="calendar" size={15} />{formatDate(data.today)}</span></div>
        <PageComponent {...pageProps} />
        <footer className="workspace-footer"><span>© {new Date(data.today).getFullYear()} Sampoerna Gold <i>·</i> Newtn Technology</span><span>Demo interaktif <i>·</i> Perubahan kembali ke awal saat halaman dimuat ulang.</span></footer>
      </main>
    </div>
    {toast && <div className={`toast ${toast.error ? 'toast-error' : ''}`} role={toast.error ? 'alert' : 'status'}><Icon name={toast.error ? 'alert' : 'checks'} size={18} /><span>{toast.message}</span><button aria-label="Tutup notifikasi" onClick={() => setToast(null)}><Icon name="close" size={15} /></button></div>}
    {help && <Modal title="Panduan admin" subtitle="Dari verifikasi hingga penutupan operasional." onClose={() => setHelp(false)}><ol className="guide-steps">{[['Tinjau anggota','Periksa contoh dokumen, verifikasi anggota, dan lihat hubungan referral.'], ['Pantau transaksi & komisi','Telusuri pembayaran, nomor seri, serta saldo komisi dari pesanan.'], ['Siapkan batch payout','Pilih saldo yang memenuhi syarat dan unduh file contoh. Konfirmasi payout hanya simulasi.'], ['Tuntaskan kendala','Tugaskan temuan kepada JV Ops atau SGI Finance, lalu catat penyelesaiannya.']].map(([title, description], index) => <li key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol><div className="inline-note"><Icon name="info" size={18} /><span>Semua data adalah contoh. Aplikasi ini berdiri sendiri, tanpa koneksi ke aplikasi Referral atau Stockpoint.</span></div></Modal>}
    {session && <Modal title="Sesi demo admin" subtitle="Sampoerna Gold · Newtn Technology" onClose={() => { setSession(false); setResetConfirm(false); }}><div className="session-profile"><span className="avatar">{initials}</span><div><h3>{data.actor}</h3><p>Administrator demo · JV Ops</p></div></div><p className="session-copy">Verifikasi, payout, penugasan, dan perubahan pengaturan hanya berjalan di browser ini. Tidak memerlukan akun, kata sandi, atau koneksi provider.</p><div className="inline-note"><Icon name="info" size={17} /><span>Reload halaman akan mengembalikan seluruh data contoh.</span></div>{resetConfirm ? <div className="reset-confirm"><p>Mulai ulang demo dan hapus perubahan dari sesi ini?</p><div className="modal-actions"><Button className="button-secondary" onClick={() => setResetConfirm(false)}>Batal</Button><Button onClick={() => { const initial = createDemoData(); dataRef.current = initial; setData(initial); setSession(false); setResetConfirm(false); notify('Demo dimulai ulang dengan data contoh.'); }}>Mulai ulang demo</Button></div></div> : <Button className="button-secondary button-full" onClick={() => setResetConfirm(true)}><Icon name="refresh" size={16} />Mulai ulang demo</Button>}</Modal>}
  </div>;
}
