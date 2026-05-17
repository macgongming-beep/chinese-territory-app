// StatePill — 같은 데이터 상태인데 view 에 따라 다른 한글 라벨 + 같은 색 그룹
//
// 전체/지도 view 어휘 | 담당 view 어휘 | 색
// ───────────────────┼──────────────┼─────────
// 방문필요              | 미사용         | danger
// 정기방문              | (정기방문)     | warn
// 완료                 | 사용완료       | ok
// 방문금지              | (숨김)         | ink
// (없음)               | 사용중         | info

import { Pill } from './Pill'

type StateLabel =
  | '방문필요'
  | '미사용'
  | '정기방문'
  | '완료'
  | '사용완료'
  | '방문금지'
  | '사용중'

const LABEL_TO_TONE: Record<StateLabel, 'danger' | 'warn' | 'ok' | 'info' | 'default'> = {
  방문필요: 'danger',
  미사용: 'danger',
  정기방문: 'warn',
  완료: 'ok',
  사용완료: 'ok',
  방문금지: 'default', // ink 톤 — Pill 의 default 위에 색 override
  사용중: 'info',
}

export function StatePill({ label }: { label: StateLabel }) {
  if (label === '방문금지') {
    return (
      <Pill
        tone="default"
        style={{ background: 'var(--ink)', color: '#fff', fontWeight: 600 }}
      >
        {label}
      </Pill>
    )
  }
  return <Pill tone={LABEL_TO_TONE[label]}>{label}</Pill>
}

export type { StateLabel }
