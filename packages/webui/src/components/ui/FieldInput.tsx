interface FieldInputProps {
  label: string;
  placeholder?: string;
  value?: string | number;
  isNum?: boolean;
  flex?: string;
  grow?: boolean;
  onChange: (v: string | number) => void;
}

export function FieldInput({ label, placeholder, value, isNum, flex, grow, onChange }: FieldInputProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${grow ? 'flex-1' : flex || ''}`}>
      <label className="text-xs font-medium pl-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input
        type={isNum ? 'number' : 'text'}
        placeholder={placeholder}
        value={value ?? ''}
        onChange={e => onChange(isNum ? (parseInt(e.target.value) || 0) : e.target.value)}
        className="h-9 px-3 rounded-lg text-sm outline-none"
        style={{
          background: 'rgba(0,0,0,0.12)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
          color: 'var(--text-primary)',
          transition: 'all 0.3s ease',
          ...(isNum ? { fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono, monospace)' } : {}),
        }}
        onFocus={e => { e.target.style.borderColor = 'var(--border-focus)'; e.target.style.boxShadow = '0 0 0 2px var(--accent-subtle)'; }}
        onBlur={e => { e.target.style.borderColor = 'var(--border-subtle)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.05)'; }}
      />
    </div>
  );
}
