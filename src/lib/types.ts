export type Page = 'overview' | 'members' | 'orders' | 'commissions' | 'stockpoints' | 'exceptions' | 'audit' | 'settings';
export type Tier = 'Registered' | 'Classic' | 'Premium';
export type Verification = 'pending' | 'verified' | 'rejected';
export interface Member {
  id: string; name: string; phoneMasked: string; referralCode: string; referrerId: string | null;
  tier: Tier; verification: Verification; status: 'active' | 'suspended'; region: string;
  joinedAt: string; lastPurchaseAt: string | null; qualifyingGrams: number; bankMasked: string; reviewNote?: string;
}
export interface Order {
  id: string; number: string; memberId: string; grams: number; quantity: number; total: number;
  status: 'pending' | 'ready' | 'done' | 'cancelled'; method: 'qris' | 'va'; stockpointId: string;
  createdAt: string; serials: string[]; referralCode: string | null;
}
export interface Commission {
  id: string; memberId: string; orderId: string; level: 0 | 1 | 2 | 3; rate: number;
  amount: number; status: 'accrued' | 'batched' | 'paid'; createdAt: string; batchId?: string;
}
export interface PayoutItem { memberId: string; amount: number; bankMasked: string; }
export interface PayoutBatch {
  id: string; number: string; period: string; total: number; items: PayoutItem[];
  status: 'draft' | 'paid'; createdAt: string; paidAt?: string;
}
export interface Stockpoint {
  id: string; name: string; city: string; address: string; staffName: string; status: 'active' | 'paused';
  capacity: number; targetMembers: number; lastReconciledAt: string | null;
}
export interface InventoryUnit {
  serial: string; stockpointId: string; grams: number; state: 'available' | 'reserved' | 'released'; orderId: string | null;
}
export interface Buyback { id: string; stockpointId: string; memberId: string; amount: number; grams: number; createdAt: string; }
export interface ExceptionRecord {
  id: string; number: string; stockpointId: string; reference: string;
  category: 'identity' | 'serial' | 'stock' | 'cash'; priority: 'normal' | 'high';
  note: string; status: 'open' | 'reviewing' | 'resolved'; assignee: 'JV Ops' | 'SGI Finance';
  createdAt: string; resolution?: string; resolvedAt?: string;
}
export interface AuditEvent {
  id: string; actor: string; action: string; entity: string; detail: string; createdAt: string;
  category: 'member' | 'finance' | 'stockpoint' | 'exception' | 'settings';
}
export interface StaffAccount {
  id: string; name: string; email: string; role: 'JV Ops' | 'SGI Finance' | 'Store Staff';
  stockpointId: string | null; active: boolean; isCurrent?: boolean;
}
export interface AdminData {
  today: string; actor: string; members: Member[]; orders: Order[]; commissions: Commission[];
  batches: PayoutBatch[]; stockpoints: Stockpoint[]; inventory: InventoryUnit[]; buybacks: Buyback[];
  exceptions: ExceptionRecord[]; audit: AuditEvent[]; staff: StaffAccount[];
  settings: { commissionMode: 'single' | 'multi'; buybackPrice: number; payoutThreshold: number; payoutDay: number; };
}
export type AdminAction =
  | { type: 'review_member'; id: string; decision: 'verified' | 'rejected'; note: string }
  | { type: 'set_member_status'; id: string; status: 'active' | 'suspended'; note: string }
  | { type: 'create_batch' }
  | { type: 'pay_batch'; id: string }
  | { type: 'set_stockpoint_status'; id: string; status: 'active' | 'paused'; note: string }
  | { type: 'update_exception'; id: string; status: 'reviewing' | 'resolved'; assignee: 'JV Ops' | 'SGI Finance'; resolution: string }
  | { type: 'set_commission_mode'; mode: 'single' | 'multi' }
  | { type: 'update_staff'; id: string; role: StaffAccount['role']; stockpointId: string | null; active: boolean };
export interface PageProps {
  data: AdminData;
  onAction: (action: AdminAction) => boolean;
  onNotify: (message: string) => void;
  onNavigate: (page: Page) => void;
}
export interface Balance { member: Member; amount: number; grams: number; eligible: boolean; reason: string; }
