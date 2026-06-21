export function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

export function formatGrade(grade: Record<string, number>): string {
  return Object.entries(grade)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatQuantity(qty: number, unit = 'MT'): string {
  return `${qty.toLocaleString('en-IN')} ${unit}`;
}
