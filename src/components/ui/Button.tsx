import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'solid' | 'ghost' | 'subtle' | 'disabled'
type Size = 'sm' | 'md' | 'lg'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: Variant
  size?: Size
  full?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
}

const SIZE_HEIGHT: Record<Size, number> = { sm: 32, md: 36, lg: 48 }
const SIZE_FONT: Record<Size, number> = { sm: 13, md: 14, lg: 15 }
const SIZE_PAD: Record<Size, string> = { sm: '0 12px', md: '0 14px', lg: '0 18px' }

function variantStyle(variant: Variant): React.CSSProperties {
  if (variant === 'solid') return { background: 'var(--ink)', color: '#fff', border: '1px solid transparent' }
  if (variant === 'ghost') return { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line-2)' }
  if (variant === 'subtle') return { background: 'var(--tint)', color: 'var(--text)', border: '1px solid transparent' }
  return { background: 'var(--tint)', color: 'var(--muted-2)', border: '1px solid transparent' }
}

export function Button({
  variant = 'solid',
  size = 'md',
  full,
  iconLeft,
  iconRight,
  children,
  disabled,
  style,
  ...rest
}: Props) {
  const effectiveVariant = disabled ? 'disabled' : variant
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        fontFamily: 'inherit',
        fontSize: SIZE_FONT[size],
        fontWeight: 600,
        padding: SIZE_PAD[size],
        height: SIZE_HEIGHT[size],
        minHeight: SIZE_HEIGHT[size], // 글로벌 button { min-height: 40 } override
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        letterSpacing: '-0.005em',
        width: full ? '100%' : undefined,
        transition: 'background 0.15s, border-color 0.15s',
        ...variantStyle(effectiveVariant),
        ...style,
      }}
    >
      {iconLeft}
      {children}
      {iconRight}
    </button>
  )
}
