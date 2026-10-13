import type { AdminAction, AdminData, AuditEvent, Balance, Member } from './types';

const DAY = 86_400_000;
export function jakartaDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Tanggal tidak valid.');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function dateNumber(value: string): number { return new Date(`${jakartaDate(value)}T00:00:00+07:00`).getTime(); }
export function isQualified(member: Member): boolean {
  return member.tier === 'Classic' ? member.qualifyingGrams >= 10 : member.tier === 'Premium' && member.qualifyingGrams >= 20;
}

function eligibilityReason(member: Member, amount: number, threshold: number): string {
  if (member.status !== 'active') return 'Keanggotaan ditangguhkan';
  if (member.verification !== 'verified') return 'Verifikasi belum disetujui';
  if (!isQualified(member)) return 'Belum memenuhi kualifikasi';
  if (amount < threshold) return 'Di bawah ambang pencairan';
  return 'Siap dibayarkan';
}

export function getBalances(data: AdminData): Balance[] {
  return data.members.map(member => {
    const amount = data.commissions.filter(entry => entry.memberId === member.id && entry.status === 'accrued').reduce((sum, entry) => sum + entry.amount, 0);
    const reason = eligibilityReason(member, amount, data.settings.payoutThreshold);
    return { member, amount, grams: data.settings.buybackPrice > 0 ? amount / data.settings.buybackPrice : 0, eligible: reason === 'Siap dibayarkan', reason };
  }).filter(balance => balance.amount > 0).sort((a, b) => b.amount - a.amount);
}

export function getMetrics(data: AdminData, days: number, stockpointId = 'all') {
  const range = Math.max(1, Math.min(365, Number.isFinite(days) ? Math.floor(days) : 30));
  const end = dateNumber(data.today);
  const start = end - (range - 1) * DAY;
  const inStockpoint = (id: string) => stockpointId === 'all' || id === stockpointId;
  const inPeriod = (value: string) => { const day = dateNumber(value); return day >= start && day <= end; };
  const paid = data.orders.filter(order => (order.status === 'ready' || order.status === 'done') && inStockpoint(order.stockpointId));
  const orders = paid.filter(order => inPeriod(order.createdAt));
  const buyerIds = new Set(orders.map(order => order.memberId));
  const active = data.members.filter(member => member.status === 'active' && member.verification === 'verified' && isQualified(member) && buyerIds.has(member.id));
  const gmv = orders.reduce((sum, order) => sum + order.total, 0);
  const buybackValue = data.buybacks.filter(item => inStockpoint(item.stockpointId) && inPeriod(item.createdAt)).reduce((sum, item) => sum + item.amount, 0);
  const retentionStart = end - 89 * DAY;
  const associated = new Set(paid.map(order => order.memberId));
  const established = data.members.filter(member => isQualified(member) && dateNumber(member.joinedAt) < retentionStart && (stockpointId === 'all' || associated.has(member.id)));
  const recent = new Set(paid.filter(order => dateNumber(order.createdAt) >= retentionStart && dateNumber(order.createdAt) <= end).map(order => order.memberId));
  const retained = established.filter(member => member.status === 'active' && member.verification === 'verified' && recent.has(member.id));
  const target = data.stockpoints.filter(point => inStockpoint(point.id)).reduce((sum, point) => sum + point.targetMembers, 0);
  const bucketCount = Math.min(range, 7);
  const salesSeries = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = start + Math.floor(index * range / bucketCount) * DAY;
    const bucketEnd = start + Math.floor((index + 1) * range / bucketCount) * DAY;
    return {
      label: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(bucketStart)),
      value: orders.filter(order => dateNumber(order.createdAt) >= bucketStart && dateNumber(order.createdAt) < bucketEnd).reduce((sum, order) => sum + order.total, 0),
    };
  });
  return { gmv, paidOrders: orders.length, activeResellers: active.length, gmvPerReseller: active.length ? gmv / active.length : 0, retention: established.length ? retained.length / established.length * 100 : 0, buybackRatio: gmv ? buybackValue / gmv * 100 : 0, penetration: target ? active.length / target * 100 : 0, salesSeries };
}

function requireNote(note: string): string {
  const trimmed = note.trim();
  if (trimmed.length < 10) throw new Error('Tuliskan catatan minimal 10 karakter.');
  return trimmed;
}
function findById<T extends { id: string }>(items: T[], id: string, label: string): T {
  const item = items.find(candidate => candidate.id === id);
  if (!item) throw new Error(`${label} tidak ditemukan.`);
  return item;
}
function nextId(prefix: string, ids: string[]): string {
  let number = ids.length + 1;
  while (ids.includes(`${prefix}${String(number).padStart(4, '0')}`)) number += 1;
  return `${prefix}${String(number).padStart(4, '0')}`;
}

export function applyAction(source: AdminData, action: AdminAction, now = new Date()): AdminData {
  const data = structuredClone(source);
  const createdAt = now.toISOString();
  data.today = createdAt;
  let audit: Pick<AuditEvent, 'action' | 'entity' | 'detail' | 'category'>;
  switch (action.type) {
    case 'review_member': {
      const member = findById(data.members, action.id, 'Mitra');
      if (member.verification !== 'pending') throw new Error('Verifikasi mitra ini sudah ditinjau.');
      const note = action.decision === 'rejected' ? requireNote(action.note) : action.note.trim();
      member.verification = action.decision;
      member.reviewNote = note;
      audit = { category: 'member', action: action.decision === 'verified' ? 'Verifikasi disetujui' : 'Verifikasi ditolak', entity: member.name, detail: note || 'Dokumen identitas demo telah ditinjau.' };
      break;
    }
    case 'set_member_status': {
      const member = findById(data.members, action.id, 'Mitra');
      if (member.status === action.status) throw new Error('Status mitra tidak berubah.');
      const note = requireNote(action.note);
      member.status = action.status;
      audit = { category: 'member', action: action.status === 'active' ? 'Mitra diaktifkan' : 'Mitra ditangguhkan', entity: member.name, detail: note };
      break;
    }
    case 'create_batch': {
      const balances = getBalances(data).filter(balance => balance.eligible);
      if (!balances.length) throw new Error('Belum ada saldo yang memenuhi syarat pencairan.');
      const id = nextId('batch-', data.batches.map(batch => batch.id));
      const number = `PAY-${jakartaDate(now).replaceAll('-', '')}-${String(data.batches.length + 1).padStart(3, '0')}`;
      const items = balances.map(({ member, amount }) => ({ memberId: member.id, amount, bankMasked: member.bankMasked }));
      const total = items.reduce((sum, item) => sum + item.amount, 0);
      data.batches.unshift({ id, number, period: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now), total, items, status: 'draft', createdAt });
      const included = new Set(items.map(item => item.memberId));
      data.commissions.forEach(entry => { if (entry.status === 'accrued' && included.has(entry.memberId)) { entry.status = 'batched'; entry.batchId = id; } });
      audit = { category: 'finance', action: 'Batch pencairan dibuat', entity: number, detail: `${items.length} penerima · Rp${total.toLocaleString('id-ID')}. Saldo di bawah ambang tetap diakumulasi.` };
      break;
    }
    case 'pay_batch': {
      const batch = findById(data.batches, action.id, 'Batch');
      if (batch.status !== 'draft') throw new Error('Batch ini sudah ditandai dibayar.');
      if (!batch.items.length) throw new Error('Batch tidak memiliki penerima.');
      for (const item of batch.items) {
        const member = findById(data.members, item.memberId, 'Penerima batch');
        const reason = eligibilityReason(member, item.amount, data.settings.payoutThreshold);
        if (reason !== 'Siap dibayarkan') throw new Error(`Batch belum dapat dibayar: ${member.name} — ${reason.toLowerCase()}. Periksa kembali kelayakan penerima.`);
      }
      batch.status = 'paid'; batch.paidAt = createdAt;
      data.commissions.forEach(entry => { if (entry.batchId === batch.id && entry.status === 'batched') entry.status = 'paid'; });
      audit = { category: 'finance', action: 'Pencairan disimulasikan', entity: batch.number, detail: `${batch.items.length} penerima ditandai dibayar. Tidak ada transfer bank yang dilakukan.` };
      break;
    }
    case 'set_stockpoint_status': {
      const point = findById(data.stockpoints, action.id, 'Stockpoint');
      if (point.status === action.status) throw new Error('Status stockpoint tidak berubah.');
      const note = requireNote(action.note);
      point.status = action.status;
      audit = { category: 'stockpoint', action: action.status === 'active' ? 'Stockpoint diaktifkan' : 'Stockpoint dijeda', entity: point.name, detail: note };
      break;
    }
    case 'update_exception': {
      const exception = findById(data.exceptions, action.id, 'Kendala');
      if (exception.status === 'resolved') throw new Error('Kendala ini sudah diselesaikan.');
      const resolution = action.status === 'resolved' ? requireNote(action.resolution) : action.resolution.trim();
      exception.status = action.status;
      exception.assignee = action.assignee;
      if (resolution) exception.resolution = resolution;
      if (action.status === 'resolved') exception.resolvedAt = createdAt;
      audit = { category: 'exception', action: action.status === 'resolved' ? 'Kendala diselesaikan' : 'Kendala ditinjau', entity: exception.number, detail: `${action.assignee} · ${resolution || 'Laporan masuk dalam proses peninjauan.'}` };
      break;
    }
    case 'set_commission_mode': {
      if (data.settings.commissionMode === action.mode) throw new Error('Mode komisi tidak berubah.');
      data.settings.commissionMode = action.mode;
      audit = { category: 'settings', action: 'Mode komisi diperbarui', entity: 'Kebijakan komisi', detail: `${action.mode === 'single' ? 'Satu level' : 'Tiga level'} untuk transaksi berikutnya. Riwayat komisi tidak dihitung ulang.` };
      break;
    }
    case 'update_staff': {
      const staff = findById(data.staff, action.id, 'Staf');
      if (staff.isCurrent && (!action.active || action.role !== staff.role || action.stockpointId !== staff.stockpointId)) throw new Error('Akses administrator yang sedang digunakan tidak dapat diubah.');
      if (action.role === 'Store Staff') {
        if (!action.stockpointId) throw new Error('Pilih stockpoint untuk Store Staff.');
        findById(data.stockpoints, action.stockpointId, 'Stockpoint');
      }
      staff.role = action.role;
      staff.stockpointId = action.role === 'Store Staff' ? action.stockpointId : null;
      staff.active = action.active;
      audit = { category: 'settings', action: 'Akses staf diperbarui', entity: staff.name, detail: `${staff.role} · ${staff.active ? 'Aktif' : 'Nonaktif'}${staff.stockpointId ? ` · ${data.stockpoints.find(point => point.id === staff.stockpointId)!.name}` : ''}. Simulasi hak akses.` };
      break;
    }
    default: throw new Error('Tindakan tidak dikenali.');
  }
  data.audit.unshift({ id: nextId('audit-', data.audit.map(event => event.id)), actor: data.actor, ...audit, createdAt });
  return data;
}
