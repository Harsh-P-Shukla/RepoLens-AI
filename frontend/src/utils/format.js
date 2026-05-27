export function formatNumber(value) {
  return new Intl.NumberFormat().format(value || 0);
}

export function formatBytes(bytes = 0) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function confidenceLabel(confidence) {
  return `${Math.round((confidence || 0) * 100)}%`;
}

