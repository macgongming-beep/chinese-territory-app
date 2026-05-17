import type { HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLDivElement> & {
  padding?: number | string
  children?: ReactNode
}

export function Card({ padding = 16, children, style, ...rest }: Props) {
  return (
    <div
      {...rest}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
