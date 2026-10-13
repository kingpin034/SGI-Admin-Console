import type { AdminData, Commission, Member, Order } from './types';
import { jakartaDate } from './domain';

const DAY = 86_400_000;
const names = ['Ayu Prameswari', 'Bima Santoso', 'Citra Maharani', 'Dedi Kurniawan', 'Elisa Putri', 'Farhan Akbar', 'Gita Puspita', 'Hendra Wijaya', 'Intan Permata', 'Joko Wibowo', 'Kartika Sari', 'Lukman Hakim', 'Maya Lestari', 'Nanda Pratama', 'Oki Saputra', 'Putri Amelia', 'Raka Aditya', 'Sinta Dewi', 'Taufik Hidayat', 'Utami Rahma', 'Vina Aprillia', 'Wahyu Nugroho', 'Yulia Anggraini', 'Zaki Ramadhan', 'Anisa Safitri', 'Bagas Prakoso', 'Dian Kusuma', 'Eko Setiawan', 'Fira Adelia', 'Galih Permana', 'Hasna Aulia', 'Irfan Maulana'];

export function createDemoData(now = new Date()): AdminData {
  const ago = (days: number, hours = 0) => new Date(now.getTime() - days * DAY - hours * 3_600_000).toISOString();
  const members: Member[] = names.map((name, index) => {
    const pending = index >= 24 && index <= 28;
    const tier = index >= 24 ? 'Registered' : index % 3 === 0 ? 'Premium' : 'Classic';
    return { id: `member-${index + 1}`, name, phoneMasked: `+62 812 •••• ${String(4101 + index)}`, referralCode: `SG-${name.split(' ')[0].toUpperCase()}${String(101 + index)}`, referrerId: index === 0 ? null : `member-${index < 4 ? 1 : Math.floor((index - 1) / 3) + 1}`, tier, verification: pending ? 'pending' : index === 29 ? 'rejected' : 'verified', status: index === 14 ? 'suspended' : 'active', region: ['Surabaya', 'Jakarta', 'Bandung', 'Malang'][index % 4], joinedAt: ago(index < 20 ? 160 - index * 3 : 20 - (index - 20)), lastPurchaseAt: null, qualifyingGrams: tier === 'Premium' ? 20 : tier === 'Classic' ? 10 : 0, bankMasked: `BCA •••• ${String(6201 + index)}`, ...(index === 29 ? { reviewNote: 'Foto identitas demo belum terbaca dengan jelas.' } : {}) };
  });
  const orders: Order[] = Array.from({ length: 44 }, (_, index) => {
    const member = members[index % 24];
    const grams = [10, 5, 1, 10, 0.5, 5, 10, 1][index % 8];
    const quantity = [2, 1, 2, 3, 1, 2, 1][index % 7];
    const status = index % 13 === 0 ? 'pending' : index % 17 === 0 ? 'cancelled' : index < 12 ? 'ready' : 'done';
    const age = index < 12 ? Math.floor(index / 3) : 4 + (index - 12) * 2;
    return { id: `order-${index + 1}`, number: `SGP-${1201 + index}`, memberId: member.id, grams, quantity, total: Math.round(grams * quantity * 1_520_000), status, method: index % 3 === 0 ? 'va' : 'qris', stockpointId: `sp-${index % 4 + 1}`, createdAt: ago(age, index % 3), serials: status === 'pending' || status === 'cancelled' ? [] : Array.from({ length: quantity }, (_, unit) => `WR-${String(805001 + index * 3 + unit)}`), referralCode: index % 9 === 0 ? null : member.referralCode };
  });
  members.forEach(member => { member.lastPurchaseAt = orders.filter(order => order.memberId === member.id && (order.status === 'ready' || order.status === 'done')).map(order => order.createdAt).sort().at(-1) || null; });
  const commissions: Commission[] = [];
  orders.filter(order => (order.status === 'ready' || order.status === 'done') && order.referralCode).forEach(order => {
    let member: Member | undefined = members.find(candidate => candidate.id === order.memberId);
    for (let level = 0; level <= 3 && member; level += 1) {
      if (member.tier !== 'Registered') {
        const rate = (member.tier === 'Premium' ? [1.5, 1, 0.5, 0.25] : [1, 0.75, 0.375, 0.1875])[level];
        commissions.push({ id: `commission-${commissions.length + 1}`, memberId: member.id, orderId: order.id, level: level as 0 | 1 | 2 | 3, rate, amount: Math.round(order.total * rate / 100), status: 'accrued', createdAt: order.createdAt });
      }
      member = member.referrerId ? members.find(candidate => candidate.id === member!.referrerId) : undefined;
    }
  });
  const historical = commissions.filter(entry => entry.memberId === 'member-1' && new Date(entry.createdAt).getTime() < now.getTime() - 35 * DAY);
  historical.forEach(entry => { entry.status = 'paid'; entry.batchId = 'batch-0001'; });
  const historicalAmount = historical.reduce((sum, entry) => sum + entry.amount, 0);
  const data: AdminData = {
    today: jakartaDate(now), actor: 'Aditya Pratama', members, orders, commissions,
    batches: historicalAmount ? [{ id: 'batch-0001', number: `PAY-${jakartaDate(ago(30)).replaceAll('-', '')}-001`, period: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(ago(30))), total: historicalAmount, items: [{ memberId: 'member-1', amount: historicalAmount, bankMasked: members[0].bankMasked }], status: 'paid', createdAt: ago(30), paidAt: ago(30) }] : [],
    stockpoints: [
      { id: 'sp-1', name: 'Waris Surabaya', city: 'Surabaya', address: 'Jl. Raya Darmo No. 72, Surabaya', staffName: 'Nadia Putri', status: 'active', capacity: 120, targetMembers: 80, lastReconciledAt: ago(0, 2) },
      { id: 'sp-2', name: 'Waris Jakarta', city: 'Jakarta', address: 'Jl. Panglima Polim No. 18, Jakarta Selatan', staffName: 'Rizky Saputra', status: 'active', capacity: 100, targetMembers: 100, lastReconciledAt: ago(1) },
      { id: 'sp-3', name: 'Waris Bandung', city: 'Bandung', address: 'Jl. Riau No. 36, Bandung', staffName: 'Dina Rahma', status: 'active', capacity: 80, targetMembers: 60, lastReconciledAt: ago(0, 3) },
      { id: 'sp-4', name: 'Waris Malang', city: 'Malang', address: 'Jl. Ijen No. 25, Malang', staffName: 'Yoga Prasetyo', status: 'paused', capacity: 60, targetMembers: 40, lastReconciledAt: ago(2) },
    ],
    inventory: [
      ...orders.flatMap(order => order.serials.map(serial => ({ serial, stockpointId: order.stockpointId, grams: order.grams, state: order.status === 'done' ? 'released' as const : 'reserved' as const, orderId: order.id }))),
      ...Array.from({ length: 64 }, (_, index) => ({ serial: `WR-${910001 + index}`, stockpointId: `sp-${Math.floor(index / 16) + 1}`, grams: [0.5, 1, 5, 10][index % 4], state: 'available' as const, orderId: null })),
    ],
    buybacks: Array.from({ length: 8 }, (_, index) => ({ id: `buyback-${index + 1}`, stockpointId: `sp-${index % 4 + 1}`, memberId: `member-${index + 1}`, amount: [1, 5, 0.5, 10][index % 4] * 1_430_000, grams: [1, 5, 0.5, 10][index % 4], createdAt: ago(index * 4 + 1) })),
    exceptions: [
      { id: 'exception-1', number: 'EXC-2041', stockpointId: 'sp-1', reference: 'SGP-1205', category: 'identity', priority: 'high', note: 'Nama pada kode pengambilan perlu dicocokkan kembali dengan identitas pelanggan.', status: 'open', assignee: 'JV Ops', createdAt: ago(0, 1) },
      { id: 'exception-2', number: 'EXC-2040', stockpointId: 'sp-2', reference: 'REK-JKT-102', category: 'cash', priority: 'high', note: 'Selisih pencatatan kas Rp150.000 pada rekonsiliasi harian.', status: 'reviewing', assignee: 'SGI Finance', createdAt: ago(1, 2) },
      { id: 'exception-3', number: 'EXC-2039', stockpointId: 'sp-3', reference: 'WR-910040', category: 'serial', priority: 'normal', note: 'Label serial kemasan kurang terbaca. Pemeriksaan fisik diminta.', status: 'open', assignee: 'JV Ops', createdAt: ago(1, 3) },
      { id: 'exception-4', number: 'EXC-2038', stockpointId: 'sp-4', reference: 'REK-MLG-098', category: 'stock', priority: 'high', note: 'Selisih satu keping emas 1 gram. Stockpoint dijeda selama pemeriksaan.', status: 'reviewing', assignee: 'JV Ops', createdAt: ago(2) },
      { id: 'exception-5', number: 'EXC-2037', stockpointId: 'sp-1', reference: 'WR-910002', category: 'serial', priority: 'normal', note: 'Pemeriksaan serial ganda pada catatan penerimaan.', status: 'resolved', assignee: 'JV Ops', createdAt: ago(3), resolution: 'Catatan penerimaan diperbaiki setelah pencocokan serial fisik.', resolvedAt: ago(2, 3) },
      { id: 'exception-6', number: 'EXC-2036', stockpointId: 'sp-2', reference: 'REK-JKT-096', category: 'cash', priority: 'normal', note: 'Perlu konfirmasi pembulatan pencatatan transaksi buyback.', status: 'resolved', assignee: 'SGI Finance', createdAt: ago(4), resolution: 'Pembulatan sudah sesuai dan dikonfirmasi oleh staf finance.', resolvedAt: ago(3) },
    ],
    audit: [
      { id: 'audit-0001', actor: 'Nadia Putri', action: 'Rekonsiliasi harian diterima', entity: 'Waris Surabaya', detail: 'Catatan stok fisik sesuai dengan saldo sistem demo.', category: 'stockpoint', createdAt: ago(0, 2) },
      { id: 'audit-0002', actor: 'Sari Wulandari', action: 'Kendala ditinjau', entity: 'EXC-2040', detail: 'Selisih pencatatan kas dialokasikan kepada SGI Finance.', category: 'exception', createdAt: ago(1, 1) },
      { id: 'audit-0003', actor: 'Aditya Pratama', action: 'Stockpoint dijeda', entity: 'Waris Malang', detail: 'Pemeriksaan selisih stok sedang berlangsung.', category: 'stockpoint', createdAt: ago(2) },
      { id: 'audit-0004', actor: 'Aditya Pratama', action: 'Verifikasi disetujui', entity: 'Yulia Anggraini', detail: 'Dokumen identitas demo telah ditinjau.', category: 'member', createdAt: ago(3) },
      { id: 'audit-0005', actor: 'Sari Wulandari', action: 'Pencairan disimulasikan', entity: 'Batch periode sebelumnya', detail: 'Status pembayaran dicatat sebagai contoh riwayat.', category: 'finance', createdAt: ago(30) },
      { id: 'audit-0006', actor: 'Aditya Pratama', action: 'Mode komisi diperbarui', entity: 'Kebijakan komisi', detail: 'Mode satu level untuk transaksi berikutnya; riwayat tiga level dipertahankan.', category: 'settings', createdAt: ago(0) },
    ],
    staff: [
      { id: 'staff-1', name: 'Aditya Pratama', email: 'aditya@example.test', role: 'JV Ops', stockpointId: null, active: true, isCurrent: true },
      { id: 'staff-2', name: 'Sari Wulandari', email: 'sari@example.test', role: 'SGI Finance', stockpointId: null, active: true },
      { id: 'staff-3', name: 'Nadia Putri', email: 'nadia@example.test', role: 'Store Staff', stockpointId: 'sp-1', active: true },
      { id: 'staff-4', name: 'Rizky Saputra', email: 'rizky@example.test', role: 'Store Staff', stockpointId: 'sp-2', active: true },
      { id: 'staff-5', name: 'Dina Rahma', email: 'dina@example.test', role: 'Store Staff', stockpointId: 'sp-3', active: true },
      { id: 'staff-6', name: 'Yoga Prasetyo', email: 'yoga@example.test', role: 'Store Staff', stockpointId: 'sp-4', active: false },
    ],
    settings: { commissionMode: 'single', buybackPrice: 1_430_000, payoutThreshold: 300_000, payoutDay: 20 },
  };
  data.audit.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return data;
}
