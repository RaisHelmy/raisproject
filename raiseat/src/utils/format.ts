import type { Unit } from '../types';

export function formatRM(n: number): string {
  return `RM${n.toFixed(2)}`;
}

export function formatRMRange(low: number, high: number): string {
  return `RM${low.toFixed(0)}–${high.toFixed(0)}`;
}

/** Human-friendly quantity: 0.6 kg → "600 g", 1.5 kg → "1.5 kg", 4 biji → "4 biji" */
export function formatQty(qty: number, unit: Unit): string {
  if (unit === 'kg' && qty < 1) return `${Math.round(qty * 1000)} g`;
  if (unit === 'g' && qty >= 1000) return `${(qty / 1000).toFixed(1)} kg`;
  if (unit === 'ml' && qty >= 1000) return `${(qty / 1000).toFixed(1)} L`;
  if (unit === 'L' && qty < 1) return `${Math.round(qty * 1000)} ml`;
  const rounded = qty % 1 === 0 ? qty.toString() : qty.toFixed(qty < 1 ? 2 : 1);
  return `${rounded} ${unit}`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

export function daysUntil(isoDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function expiryLabel(isoDate?: string): { text: string; tone: 'danger' | 'warning' | 'ok' | 'none' } {
  if (!isoDate) return { text: '', tone: 'none' };
  const d = daysUntil(isoDate);
  if (d < 0) return { text: 'Expired', tone: 'danger' };
  if (d === 0) return { text: 'Expires today', tone: 'danger' };
  if (d === 1) return { text: 'Expires tomorrow', tone: 'danger' };
  if (d <= 3) return { text: `Expires in ${d} days`, tone: 'warning' };
  return { text: `${d} days left`, tone: 'ok' };
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}
