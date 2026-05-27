import { AlertTriangle } from 'lucide-react';

export default function ErrorBanner({ message, compact = false }) {
  if (!message) return null;

  return (
    <div
      className={`mt-3 flex items-start gap-3 border border-roseLens/30 bg-roseLens/10 text-rose-100 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-roseLens" />
      <span>{message}</span>
    </div>
  );
}

