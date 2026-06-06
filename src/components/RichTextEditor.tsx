// 자유양식 제안 본문용 간단 리치텍스트 에디터 (굵게/밑줄/글자색)
// - contentEditable + document.execCommand (구식이지만 모든 브라우저 지원, 이 범위엔 충분)
// - uncontrolled: 타이핑 중 React 가 innerHTML 을 덮어쓰지 않게 함 (커서 튐 방지)
// - 저장/표시 시점에 sanitizeRichText 로 정제 (여기선 원본 HTML 그대로 emit)

import { useEffect, useRef } from 'react'

const COLORS: { label: string; value: string }[] = [
  { label: '기본', value: '#1c1c1a' },
  { label: '빨강', value: '#dc2626' },
  { label: '주황', value: '#ea580c' },
  { label: '초록', value: '#16a34a' },
  { label: '파랑', value: '#2563eb' },
  { label: '보라', value: '#7c3aed' },
]

// execCommand('fontSize') 값(1~7) → 표시 라벨/크기. styleWithCSS=true 라 <span style="font-size">로 저장됨.
const SIZES: { label: string; value: string; px: number }[] = [
  { label: '작게', value: '2', px: 13 },
  { label: '보통', value: '3', px: 16 },
  { label: '크게', value: '5', px: 22 },
  { label: '아주크게', value: '6', px: 26 },
]

type Props = {
  value: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // 외부 값 변경 동기화 — 단, 에디터에 포커스(타이핑 중)면 건드리지 않음
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if ((value || '') !== el.innerHTML) el.innerHTML = value || ''
  }, [value])

  const emit = () => {
    if (ref.current) onChange(ref.current.innerHTML)
  }

  const exec = (command: string, arg?: string) => {
    // 색은 <span style="color">로 통일
    try { document.execCommand('styleWithCSS', false, 'true') } catch { /* 일부 브라우저 미지원 */ }
    document.execCommand(command, false, arg)
    ref.current?.focus()
    emit()
  }

  // 버튼 mousedown 으로 에디터 선택영역이 풀리지 않게 preventDefault
  const keepSelection = (e: React.MouseEvent) => e.preventDefault()

  const btnStyle: React.CSSProperties = {
    minWidth: 32, height: 30, padding: '0 8px', border: '1px solid var(--line-muted)',
    borderRadius: 6, background: 'var(--surface)', color: 'var(--ink)', cursor: 'pointer',
    fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div style={{ border: '1px solid var(--brand)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      {/* 툴바 */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 8px', borderBottom: '1px solid var(--line-muted)', background: 'var(--bg-subtle, #f8f8f7)' }}>
        <button type="button" onMouseDown={keepSelection} onClick={() => exec('bold')} style={{ ...btnStyle, fontWeight: 800 }} title="굵게">B</button>
        <button type="button" onMouseDown={keepSelection} onClick={() => exec('underline')} style={{ ...btnStyle, textDecoration: 'underline' }} title="밑줄">U</button>
        <span style={{ width: 1, height: 18, background: 'var(--line-muted)', margin: '0 2px' }} />
        {COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            onMouseDown={keepSelection}
            onClick={() => exec('foreColor', c.value)}
            title={`글자색: ${c.label}`}
            style={{ ...btnStyle, minWidth: 26, padding: 0 }}
          >
            <span style={{ width: 16, height: 16, borderRadius: '50%', background: c.value, display: 'block', border: '1px solid rgba(0,0,0,0.15)' }} />
          </button>
        ))}
        <span style={{ width: 1, height: 18, background: 'var(--line-muted)', margin: '0 2px' }} />
        {SIZES.map((s) => (
          <button
            key={s.value}
            type="button"
            onMouseDown={keepSelection}
            onClick={() => exec('fontSize', s.value)}
            title={`글자 크기: ${s.label}`}
            style={{ ...btnStyle, fontSize: Math.min(s.px, 17), lineHeight: 1 }}
          >
            가
          </button>
        ))}
      </div>
      {/* 본문 */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder ?? ''}
        className="rte-content"
        style={{ minHeight: 160, padding: '12px 14px', fontSize: 15, lineHeight: 1.6, color: 'var(--ink)', outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      />
    </div>
  )
}
