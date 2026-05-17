import type { InputHTMLAttributes, ReactNode } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

export function Input({ iconLeft, iconRight, style, ...rest }: Props) {
  return (
    <label
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 10,
        padding: '11px 14px',
        fontSize: 14,
        color: 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'text',
      }}
    >
      {iconLeft && (
        <span style={{ flexShrink: 0, color: 'var(--muted-2)', display: 'inline-flex' }}>{iconLeft}</span>
      )}
      <input
        {...rest}
        style={{
          flex: 1,
          minWidth: 0,
          border: 'none',
          outline: 'none',
          background: 'transparent',
          font: 'inherit',
          color: 'inherit',
          padding: 0,
          ...style,
        }}
      />
      {iconRight && (
        <span style={{ flexShrink: 0, color: 'var(--muted-2)', display: 'inline-flex' }}>{iconRight}</span>
      )}
    </label>
  )
}
