import { describe, expect, it } from 'vitest';
import { createDemoData } from '../src/lib/demo';
import { applyAction, getBalances, getMetrics, jakartaDate } from '../src/lib/domain';
import type { AdminData } from '../src/lib/types';

const now = new Date('2026-10-13T06:30:00.000Z');
const fresh = () => createDemoData(now);
const note = 'Pemeriksaan dokumen demo telah selesai.';
function balanceFixture(): AdminData {
  const data = fresh();
  data.members = data.members.slice(0, 6);
  data.commissions = data.members.map((member, index) => ({ id: `commission-test-${index}`, memberId: member.id, orderId: data.orders[1].id, level: 0, rate: 1, amount: index === 1 ? 299_999 : 300_000, status: 'accrued', createdAt: now.toISOString() }));
  data.members[2].verification = 'pending';
  data.members[3].status = 'suspended';
  data.members[4].qualifyingGrams = 5;
  data.members[5].tier = 'Registered';
  return data;
}

describe('Deterministic local demo dataset', () => {
  it('keeps every reserved/released serial assigned once to its exact order and stockpoint', () => {
    const data = fresh();
    expect(data.members).toHaveLength(32);
    expect(data.stockpoints).toHaveLength(4);
    expect(new Set(data.inventory.map(unit => unit.serial)).size).toBe(data.inventory.length);
    for (const order of data.orders) {
      const serialized = order.status === 'ready' || order.status === 'done';
      expect(order.serials).toHaveLength(serialized ? order.quantity : 0);
      for (const serial of order.serials) {
        expect(data.inventory.find(unit => unit.serial === serial)).toMatchObject({ orderId: order.id, stockpointId: order.stockpointId, grams: order.grams, state: order.status === 'done' ? 'released' : 'reserved' });
      }
    }
  });

  it('creates commission entries only against referred paid orders at the correct rate', () => {
    const data = fresh();
    for (const entry of data.commissions) {
      const order = data.orders.find(candidate => candidate.id === entry.orderId)!;
      expect(['ready', 'done']).toContain(order.status);
      expect(order.referralCode).toBeTruthy();
      expect(entry.amount).toBe(Math.round(order.total * entry.rate / 100));
    }
    expect(getBalances(data).some(balance => balance.eligible)).toBe(true);
    expect(getBalances(data).some(balance => balance.amount < data.settings.payoutThreshold)).toBe(true);
  });

  it('keeps exception locations and historical payout totals consistent with their referenced records', () => {
    const data = fresh();
    for (const exception of data.exceptions) {
      if (exception.reference.startsWith('SGP-')) {
        expect(data.orders.find(order => order.number === exception.reference)?.stockpointId).toBe(exception.stockpointId);
      } else if (exception.reference.startsWith('WR-')) {
        expect(data.inventory.find(unit => unit.serial === exception.reference)?.stockpointId).toBe(exception.stockpointId);
      }
    }
    for (const batch of data.batches) {
      expect(batch.total).toBe(batch.items.reduce((sum, item) => sum + item.amount, 0));
      const ledger = data.commissions.filter(entry => entry.batchId === batch.id);
      expect(ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(batch.total);
      for (const item of batch.items) {
        expect(item.amount).toBeGreaterThanOrEqual(data.settings.payoutThreshold);
        expect(ledger.filter(entry => entry.memberId === item.memberId).reduce((sum, entry) => sum + entry.amount, 0)).toBe(item.amount);
        expect(data.members.find(member => member.id === item.memberId)?.bankMasked).toBe(item.bankMasked);
      }
      expect(ledger.every(entry => entry.status === batch.status && entry.createdAt <= batch.createdAt)).toBe(true);
    }
  });

  it('resets by creating independent data and respects the Jakarta date boundary', () => {
    expect(jakartaDate('2026-10-12T18:30:00.000Z')).toBe('2026-10-13');
    const first = fresh();
    first.members[0].name = 'Changed';
    expect(fresh().members[0].name).toBe('Ayu Prameswari');
    expect(fresh()).toEqual(fresh());
  });
});

describe('Member and staff governance', () => {
  it('approves a pending verification, preserves the original state, and audits the change', () => {
    const source = fresh();
    const pending = source.members.find(member => member.verification === 'pending')!;
    const next = applyAction(source, { type: 'review_member', id: pending.id, decision: 'verified', note: '' }, now);
    expect(next.members.find(member => member.id === pending.id)!.verification).toBe('verified');
    expect(pending.verification).toBe('pending');
    expect(next.audit).toHaveLength(source.audit.length + 1);
    expect(next.audit[0]).toMatchObject({ actor: source.actor, category: 'member', createdAt: now.toISOString() });
  });

  it('requires a rejection reason and prevents reviewing a decided member again', () => {
    const source = fresh();
    const pending = source.members.find(member => member.verification === 'pending')!;
    expect(() => applyAction(source, { type: 'review_member', id: pending.id, decision: 'rejected', note: 'blur' }, now)).toThrow('10 karakter');
    const next = applyAction(source, { type: 'review_member', id: pending.id, decision: 'rejected', note }, now);
    expect(next.members.find(member => member.id === pending.id)!.reviewNote).toBe(note);
    expect(() => applyAction(next, { type: 'review_member', id: pending.id, decision: 'verified', note }, now)).toThrow('sudah ditinjau');
  });

  it('requires notes for suspension/restoration and rejects unchanged statuses', () => {
    const source = fresh();
    expect(() => applyAction(source, { type: 'set_member_status', id: 'member-1', status: 'suspended', note: ' ' }, now)).toThrow('10 karakter');
    const suspended = applyAction(source, { type: 'set_member_status', id: 'member-1', status: 'suspended', note }, now);
    expect(getBalances(suspended).find(balance => balance.member.id === 'member-1')?.eligible).toBe(false);
    const active = applyAction(suspended, { type: 'set_member_status', id: 'member-1', status: 'active', note }, now);
    expect(active.members[0].status).toBe('active');
    expect(() => applyAction(active, { type: 'set_member_status', id: 'member-1', status: 'active', note }, now)).toThrow('tidak berubah');
  });

  it('requires Store Staff to have a valid assigned stockpoint', () => {
    const data = fresh();
    expect(() => applyAction(data, { type: 'update_staff', id: 'staff-2', role: 'Store Staff', stockpointId: null, active: true }, now)).toThrow('Pilih stockpoint');
    expect(() => applyAction(data, { type: 'update_staff', id: 'staff-2', role: 'Store Staff', stockpointId: 'missing', active: true }, now)).toThrow('tidak ditemukan');
    const next = applyAction(data, { type: 'update_staff', id: 'staff-2', role: 'Store Staff', stockpointId: 'sp-2', active: true }, now);
    expect(next.staff[1]).toMatchObject({ role: 'Store Staff', stockpointId: 'sp-2' });
    expect(next.audit[0].category).toBe('settings');
  });

  it('protects the current administrator and clears locations from non-store roles', () => {
    const data = fresh();
    expect(() => applyAction(data, { type: 'update_staff', id: 'staff-1', role: 'JV Ops', stockpointId: null, active: false }, now)).toThrow('sedang digunakan');
    expect(() => applyAction(data, { type: 'update_staff', id: 'staff-1', role: 'SGI Finance', stockpointId: null, active: true }, now)).toThrow('sedang digunakan');
    const next = applyAction(data, { type: 'update_staff', id: 'staff-3', role: 'SGI Finance', stockpointId: 'sp-1', active: true }, now);
    expect(next.staff[2].stockpointId).toBeNull();
  });
});

describe('Commission balances and payouts', () => {
  it('applies the exact threshold and all membership eligibility conditions', () => {
    const data = balanceFixture();
    const balances = getBalances(data);
    expect(balances.filter(balance => balance.eligible).map(balance => balance.member.id)).toEqual(['member-1']);
    expect(balances.find(balance => balance.member.id === 'member-2')).toMatchObject({ amount: 299_999, eligible: false });
    expect(balances.find(balance => balance.member.id === 'member-2')!.grams).toBeCloseTo(299_999 / 1_430_000);
  });

  it('batches only eligible accrued entries and retains smaller balances as accrued', () => {
    const source = balanceFixture();
    const next = applyAction(source, { type: 'create_batch' }, now);
    const batch = next.batches[0];
    expect(batch.items).toEqual([{ memberId: 'member-1', amount: 300_000, bankMasked: source.members[0].bankMasked }]);
    expect(batch.total).toBe(300_000);
    expect(next.commissions[0]).toMatchObject({ status: 'batched', batchId: batch.id });
    expect(next.commissions.slice(1).every(entry => entry.status === 'accrued')).toBe(true);
    expect(source.commissions.every(entry => entry.status === 'accrued')).toBe(true);
    expect(next.audit[0].category).toBe('finance');
  });

  it('prevents duplicating a batch after eligible entries have been allocated', () => {
    const next = applyAction(balanceFixture(), { type: 'create_batch' }, now);
    expect(() => applyAction(next, { type: 'create_batch' }, now)).toThrow('Belum ada saldo');
  });

  it('marks a draft batch and its ledger entries paid once without touching other entries', () => {
    const draft = applyAction(balanceFixture(), { type: 'create_batch' }, now);
    const paid = applyAction(draft, { type: 'pay_batch', id: draft.batches[0].id }, now);
    expect(paid.batches[0]).toMatchObject({ status: 'paid', paidAt: now.toISOString() });
    expect(paid.commissions[0].status).toBe('paid');
    expect(paid.commissions[1].status).toBe('accrued');
    expect(() => applyAction(paid, { type: 'pay_batch', id: paid.batches[0].id }, now)).toThrow('sudah ditandai');
    expect(paid.audit[0].detail).toContain('Tidak ada transfer bank');
  });

  it('revalidates recipients before paying and retains the entire draft when eligibility changes', () => {
    const source = balanceFixture();
    source.commissions[1].amount = 300_000;
    const draft = applyAction(source, { type: 'create_batch' }, now);
    expect(draft.batches[0].items).toHaveLength(2);
    const suspended = applyAction(draft, { type: 'set_member_status', id: 'member-2', status: 'suspended', note }, now);
    const snapshot = structuredClone(suspended);
    expect(() => applyAction(suspended, { type: 'pay_batch', id: suspended.batches[0].id }, now)).toThrow('keanggotaan ditangguhkan');
    expect(suspended).toEqual(snapshot);
    expect(suspended.batches[0].status).toBe('draft');
    expect(suspended.commissions.slice(0, 2).every(entry => entry.status === 'batched')).toBe(true);
    const restored = applyAction(suspended, { type: 'set_member_status', id: 'member-2', status: 'active', note }, now);
    expect(applyAction(restored, { type: 'pay_batch', id: restored.batches[0].id }, now).batches[0].status).toBe('paid');
  });

  it('blocks payment when current verification or qualification no longer supports a batched recipient', () => {
    const draft = applyAction(balanceFixture(), { type: 'create_batch' }, now);
    const unverified = structuredClone(draft);
    unverified.members[0].verification = 'rejected';
    expect(() => applyAction(unverified, { type: 'pay_batch', id: unverified.batches[0].id }, now)).toThrow('verifikasi belum disetujui');
    const unqualified = structuredClone(draft);
    unqualified.members[0].qualifyingGrams = 5;
    expect(() => applyAction(unqualified, { type: 'pay_batch', id: unqualified.batches[0].id }, now)).toThrow('belum memenuhi kualifikasi');
    expect(unverified.batches[0].status).toBe('draft');
    expect(unqualified.commissions[0].status).toBe('batched');
  });

  it('changes future commission policy without changing historical ledger amounts', () => {
    const data = fresh();
    const next = applyAction(data, { type: 'set_commission_mode', mode: 'multi' }, now);
    expect(next.settings.commissionMode).toBe('multi');
    expect(next.commissions).toEqual(data.commissions);
    expect(next.batches).toEqual(data.batches);
    expect(next.audit[0].detail).toContain('Riwayat komisi tidak dihitung ulang');
    expect(() => applyAction(next, { type: 'set_commission_mode', mode: 'multi' }, now)).toThrow('tidak berubah');
  });
});

describe('Stockpoint exceptions', () => {
  it('requires a note to pause or resume a stockpoint and preserves stock/orders', () => {
    const data = fresh();
    expect(() => applyAction(data, { type: 'set_stockpoint_status', id: 'sp-1', status: 'paused', note: 'short' }, now)).toThrow('10 karakter');
    const paused = applyAction(data, { type: 'set_stockpoint_status', id: 'sp-1', status: 'paused', note }, now);
    expect(paused.stockpoints[0].status).toBe('paused');
    expect(paused.inventory).toEqual(data.inventory);
    expect(paused.orders).toEqual(data.orders);
    expect(paused.audit[0].category).toBe('stockpoint');
    expect(applyAction(paused, { type: 'set_stockpoint_status', id: 'sp-1', status: 'active', note }, now).stockpoints[0].status).toBe('active');
  });

  it('assigns an open exception and requires a resolution before closing it', () => {
    const data = fresh();
    const reviewing = applyAction(data, { type: 'update_exception', id: 'exception-1', status: 'reviewing', assignee: 'SGI Finance', resolution: '' }, now);
    expect(reviewing.exceptions[0]).toMatchObject({ status: 'reviewing', assignee: 'SGI Finance' });
    expect(() => applyAction(reviewing, { type: 'update_exception', id: 'exception-1', status: 'resolved', assignee: 'SGI Finance', resolution: '' }, now)).toThrow('10 karakter');
    const resolved = applyAction(reviewing, { type: 'update_exception', id: 'exception-1', status: 'resolved', assignee: 'SGI Finance', resolution: note }, now);
    expect(resolved.exceptions[0]).toMatchObject({ status: 'resolved', resolution: note, resolvedAt: now.toISOString() });
    expect(resolved.audit[0].category).toBe('exception');
    expect(() => applyAction(resolved, { type: 'update_exception', id: 'exception-1', status: 'reviewing', assignee: 'JV Ops', resolution: '' }, now)).toThrow('sudah diselesaikan');
  });

  it('rejects unknown entity IDs and retains the original data on failed actions', () => {
    const data = fresh();
    const snapshot = structuredClone(data);
    expect(() => applyAction(data, { type: 'set_member_status', id: 'missing', status: 'suspended', note }, now)).toThrow('tidak ditemukan');
    expect(() => applyAction(data, { type: 'pay_batch', id: 'missing' }, now)).toThrow('tidak ditemukan');
    expect(data).toEqual(snapshot);
  });
});

describe('Computed KPI definitions', () => {
  it('filters paid GMV by Jakarta date and stockpoint while keeping chart totals equal', () => {
    const data = fresh();
    const metrics = getMetrics(data, 7, 'sp-1');
    const start = new Date('2026-10-07T00:00:00+07:00').getTime();
    const included = data.orders.filter(order => ['ready', 'done'].includes(order.status) && order.stockpointId === 'sp-1' && new Date(order.createdAt).getTime() >= start);
    expect(metrics.gmv).toBe(included.reduce((sum, order) => sum + order.total, 0));
    expect(metrics.paidOrders).toBe(included.length);
    expect(metrics.salesSeries.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(metrics.gmv);
    expect(getMetrics(data, 30).salesSeries.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(getMetrics(data, 30).gmv);
  });

  it('computes buyback ratio in currency, unique active resellers, and target penetration', () => {
    const data = fresh();
    data.orders = data.orders.filter(order => order.memberId === 'member-2').map(order => ({ ...order, stockpointId: 'sp-1', status: 'done', createdAt: now.toISOString(), total: 10_000_000 }));
    data.buybacks = [{ id: 'test-buyback', memberId: 'member-2', stockpointId: 'sp-1', amount: 1_000_000, grams: 0.5, createdAt: now.toISOString() }];
    const metrics = getMetrics(data, 7, 'sp-1');
    expect(metrics.activeResellers).toBe(1);
    expect(metrics.gmvPerReseller).toBe(metrics.gmv);
    expect(metrics.buybackRatio).toBe(1_000_000 / metrics.gmv * 100);
    expect(metrics.penetration).toBe(1 / data.stockpoints[0].targetMembers * 100);
  });

  it('calculates a 90-day existing-member retention cohort and safe zero-denominator results', () => {
    const data = fresh();
    data.members = data.members.slice(0, 3);
    data.members.forEach(member => { member.joinedAt = '2026-01-01T00:00:00.000Z'; });
    data.members[2].joinedAt = '2026-10-01T00:00:00.000Z';
    data.orders = [{ ...data.orders[1], memberId: data.members[0].id, status: 'done', createdAt: now.toISOString() }];
    expect(getMetrics(data, 7).retention).toBe(50);
    data.members[0].status = 'suspended';
    expect(getMetrics(data, 7).retention).toBe(0);
    expect(getMetrics(data, 7, 'missing')).toMatchObject({ gmv: 0, paidOrders: 0, activeResellers: 0, gmvPerReseller: 0, retention: 0, buybackRatio: 0, penetration: 0 });
  });
});
