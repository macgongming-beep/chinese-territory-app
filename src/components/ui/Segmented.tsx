import type { ReactNode } from 'react'

type Option<V extends string> = {
  value: V
  label: ReactNode
}

type Props<V extends string> = {
  options: Option<V>[]
  value: V
  onChange: (value: V) => void
  ariaLabel?: string
}

export function Segmented<V extends string>({ options, value, onChange, ariaLabel }: Props<V>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{
        background: 'var(--tint)',
        borderRadius: 10,
        padding: 3,
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: 0,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            type="button"
            style={{
              border: 'none',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: active ? 600 : 500,
              color: active ? 'var(--ink)' : 'var(--muted)',
              padding: '9px 8px',
              borderRadius: 7,
              textAlign: 'center',
              letterSpacing: '-0.005em',
              background: active ? 'var(--surface)' : 'transparent',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              cursor: 'pointer',
              transition: 'background 0.12s, color 0.12s, font-weight 0.12s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
