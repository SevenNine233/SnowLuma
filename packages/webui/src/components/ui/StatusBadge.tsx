interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const isOnline = status === '已连接';
  const isConnecting = status === '连接中';

  const dotColor = isOnline
    ? 'var(--color-success)'
    : isConnecting
      ? 'var(--color-warning)'
      : 'var(--text-tertiary)';

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: dotColor, background: `color-mix(in srgb, ${dotColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${dotColor} 20%, transparent)` }}
    >
      <span
        className={`size-1.5 rounded-full shrink-0 ${isOnline ? 'animate-pulse' : ''}`}
        style={{ background: dotColor }}
      />
      {status}
    </span>
  );
}
