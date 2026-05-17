import type { HTMLAttributes, ReactNode } from 'react'

type Tone = 'default' | 'danger' | 'warn' | 'ok' | 'info'

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone
  children?: ReactNode
}

function toneStyle(tone: Tone): React.CSSProperties {
  if (tone === 'danger') return { background: 'var(--status-danger-bg)', color: 'var(--status-danger)', fontWeight: 600 }
  if (tone === 'warn') return { background: 'var(--status-warn-bg)', color: 'var(--status-warn)', fontWeight: 600 }
  if (tone === 'ok') return { background: 'var(--status-ok-bg)', color: 'var(--status-ok)', fontWeight: 600 }
  if (tone === 'info') return { background: 'var(--status-info-bg)', color: 'var(--status-info)', fontWeight: 600 }
  return { background: 'var(--tint)', color: 'var(--text)', fontWeight: 500 }
}

export function Pill({ tone = 'default', children, style, ...rest }: Props) {
  return (
    <span
      {...rest}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11.5,
        padding: '3px 9px',
        borderRadius: 999,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: 0,
        ...toneStyle(tone),
        ...style,
      }}
    >
      {children}
    </span>
  )
}
