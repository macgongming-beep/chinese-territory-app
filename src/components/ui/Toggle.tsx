type Props = {
  on: boolean
  onChange: (next: boolean) => void
  ariaLabel?: string
  disabled?: boolean
}

export function Toggle({ on, onChange, ariaLabel, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      style={{
        width: 40,
        height: 24,
        background: on ? 'var(--ink)' : 'var(--line)',
        borderRadius: 99,
        border: 'none',
        padding: 0,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.18s',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 18,
          height: 18,
          background: '#fff',
          borderRadius: '50%',
          top: 3,
          left: on ? 19 : 3,
          transition: 'left 0.18s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        }}
      />
    </button>
  )
}
