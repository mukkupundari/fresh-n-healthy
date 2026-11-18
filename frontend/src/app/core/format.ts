import { OrderStatus, PaymentStatus, ProductUnit } from './models';

const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrExact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatInr(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return Number.isInteger(Math.round(n * 100) / 100) ? inrWhole.format(n) : inrExact.format(n);
}

export function trimNumber(n: number, digits = 3): string {
  return Number(n.toFixed(digits)).toString();
}

export function formatQty(qty: number, unit: ProductUnit): string {
  switch (unit) {
    case 'Kg': return qty < 1 ? `${Math.round(qty * 1000)} g` : `${trimNumber(qty)} kg`;
    case 'Piece': return `${trimNumber(qty)} pc`;
    case 'Bunch': return `${trimNumber(qty)} ${qty === 1 ? 'bunch' : 'bunches'}`;
    case 'Pack': return `${trimNumber(qty)} ${qty === 1 ? 'pack' : 'packs'}`;
  }
}

export function unitShort(unit: ProductUnit): string {
  return { Kg: 'kg', Piece: 'pc', Bunch: 'bunch', Pack: 'pack' }[unit];
}

export function unitLong(unit: ProductUnit): string {
  return { Kg: 'Kilogram', Piece: 'Piece', Bunch: 'Bunch', Pack: 'Pack' }[unit];
}

export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'ReadyForDelivery', 'Completed', 'Cancelled'];

export function statusLabel(status: OrderStatus): string {
  return status === 'ReadyForDelivery' ? 'Ready for delivery' : status;
}

export function statusTone(status: OrderStatus): string {
  return { Pending: 'amber', Confirmed: 'blue', Processing: 'blue', ReadyForDelivery: 'lime', Completed: 'green', Cancelled: 'red' }[status];
}

export function paymentTone(status: PaymentStatus): string {
  return { Pending: 'amber', Paid: 'green', Failed: 'red', Refunded: 'blue' }[status];
}

/** Largest multiple of `step` that is <= `value`, guarding against floating point drift. */
export function floorToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(Math.floor(value / step + 1e-9) * step * 1000) / 1000;
}

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function upiLink(upiId: string, payee: string | null, amount: number, note: string): string {
  const params = new URLSearchParams({ pa: upiId, pn: payee ?? '', am: amount.toFixed(2), cu: 'INR', tn: note });
  return `upi://pay?${params.toString()}`;
}
