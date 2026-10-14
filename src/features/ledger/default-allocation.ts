export function defaultAllocationValueFor(mode: 'equal' | 'exact' | 'percentage' | 'shares', index: number, count: number) {
  if (mode === 'shares') return '1';
  if (mode === 'percentage') {
    const base = Math.floor(100 / Math.max(count, 1));
    return String(base + (index < 100 % Math.max(count, 1) ? 1 : 0));
  }
  return '';
}
