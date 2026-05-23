import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

// ── 실제 앱 팔레트 ──────────────────────────────────────────
const CHARCOAL  = '#1A1A1A'   // 앱 ink (가장 진한 회색)
const COBALT    = '#1848A8'   // 앱 primary blue (진한 버전이 아이콘에 더 좋음)
const WARM_DARK = '#2D2926'   // 따뜻한 차콜 (브라운 언더톤, 앱 charcoal 계열)
const W         = 'rgba(255,255,255,0.95)'
const W_DIM     = 'rgba(255,255,255,0.20)'
const W_MED     = 'rgba(255,255,255,0.55)'

// ── 심볼 A: Location Pin ───────────────────────────────────
// 원 + 아래 포인트, 안쪽 구멍 = 구역 핀
function pinSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <path d="
    M 256 102
    A 114 114 0 1 1 142 292
    L 256 420
    L 370 292
    A 114 114 0 0 1 256 102 Z
  " fill="${W}"/>
  <circle cx="256" cy="216" r="50" fill="${bg}"/>
</svg>`
}

// ── 심볼 B: 구역 카드 (Stacked Cards) ─────────────────────
// 두 장의 카드가 살짝 겹친 형태 = 구역 카드 느낌
function cardSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 뒤 카드 (약간 회전, 어둡게) -->
  <rect x="118" y="155" width="248" height="185" rx="22"
        fill="${W_DIM}" transform="rotate(-6 242 247)"/>
  <!-- 앞 카드 (흰색) -->
  <rect x="142" y="168" width="248" height="185" rx="22" fill="${W}"/>
  <!-- 카드 내부 라인 (구역 정보 느낌) -->
  <rect x="172" y="208" width="88" height="12" rx="6" fill="${bg}" opacity="0.18"/>
  <rect x="172" y="228" width="148" height="9" rx="4.5" fill="${bg}" opacity="0.11"/>
  <rect x="172" y="245" width="118" height="9" rx="4.5" fill="${bg}" opacity="0.11"/>
  <!-- 작은 핀 닷 (우상단) -->
  <circle cx="348" cy="204" r="18" fill="${bg}" opacity="0.22"/>
  <circle cx="348" cy="204" r="9"  fill="${bg}" opacity="0.5"/>
</svg>`
}

// ── 심볼 C: 구역 경계선 (Territory Bounds) ─────────────────
// 오각형 테두리 + 꼭짓점 닷 = 지도의 구역 경계선
function boundsSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 구역 경계 폴리곤 (테두리) -->
  <polygon
    points="256,100 390,185 345,340 167,340 122,185"
    fill="none"
    stroke="${W}"
    stroke-width="26"
    stroke-linejoin="round"
    stroke-linecap="round"
    opacity="0.9"
  />
  <!-- 꼭짓점 닷들 (작은) -->
  <circle cx="256" cy="100" r="14" fill="${W}"/>
  <circle cx="390" cy="185" r="14" fill="${W}"/>
  <circle cx="345" cy="340" r="14" fill="${W}"/>
  <circle cx="167" cy="340" r="14" fill="${W}"/>
  <circle cx="122" cy="185" r="14" fill="${W}"/>
</svg>`
}

// ── 심볼 D: 2×2 블록 그리드 ────────────────────────────────
// 네 칸 중 하나 강조 = 구역 선택/배정 느낌
function gridSVG(bg) {
  const GAP = 18
  const CELL = 158
  const ORIGIN_X = (512 - CELL*2 - GAP) / 2
  const ORIGIN_Y = (512 - CELL*2 - GAP) / 2
  const R = 20
  const x1 = ORIGIN_X, x2 = ORIGIN_X + CELL + GAP
  const y1 = ORIGIN_Y, y2 = ORIGIN_Y + CELL + GAP
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 왼쪽 위 (어둡게) -->
  <rect x="${x1}" y="${y1}" width="${CELL}" height="${CELL}" rx="${R}" fill="${W_DIM}"/>
  <!-- 오른쪽 위 (강조) -->
  <rect x="${x2}" y="${y1}" width="${CELL}" height="${CELL}" rx="${R}" fill="${W}"/>
  <!-- 왼쪽 아래 (어둡게) -->
  <rect x="${x1}" y="${y2}" width="${CELL}" height="${CELL}" rx="${R}" fill="${W_DIM}"/>
  <!-- 오른쪽 아래 (중간) -->
  <rect x="${x2}" y="${y2}" width="${CELL}" height="${CELL}" rx="${R}" fill="${W_MED}"/>
  <!-- 강조 칸(우상단) 위에 핀 닷 -->
  <circle cx="${x2 + CELL/2}" cy="${y1 + CELL/2}" r="28" fill="${bg}" opacity="0.25"/>
  <circle cx="${x2 + CELL/2}" cy="${y1 + CELL/2}" r="13" fill="${bg}" opacity="0.65"/>
</svg>`
}

// ── 생성 목록 ───────────────────────────────────────────────
const COLORS = [
  { key: 'charcoal', bg: CHARCOAL,  label: '차콜' },
  { key: 'cobalt',   bg: COBALT,    label: '코발트' },
  { key: 'warm',     bg: WARM_DARK, label: '웜다크' },
]

const SYMBOLS = [
  { key: 'A', label: '로케이션 핀',    fn: pinSVG },
  { key: 'B', label: '구역 카드',      fn: cardSVG },
  { key: 'C', label: '구역 경계선',    fn: boundsSVG },
  { key: 'D', label: '2×2 블록 그리드', fn: gridSVG },
]

const designs = []
for (const sym of SYMBOLS) {
  for (const col of COLORS) {
    const name = `prev-${sym.key}-${col.key}`
    designs.push({ name, svg: sym.fn(col.bg), sym, col })
  }
}

for (const { name, svg } of designs) {
  const out = path.join(outDir, `${name}.png`)
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(out)
  process.stdout.write(`✓ ${name}\n`)
}

// ── HTML 비교 페이지 ────────────────────────────────────────
const cards = designs.map(({ name, sym, col }) => `
  <div class="card">
    <img src="${name}.png" loading="lazy">
    <span class="sym">${sym.key}</span>
    <span class="lbl">${sym.label}</span>
    <span class="col">${col.label}</span>
  </div>`).join('')

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>앱 아이콘 비교</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #EDECE9; padding: 40px 32px 64px; }
  h1 { font-size: 18px; font-weight: 700; color: #1A1A1A; margin-bottom: 8px; }
  p  { font-size: 13px; color: #888; margin-bottom: 32px; }
  .grid { display: grid; grid-template-columns: repeat(3, 140px); gap: 20px 16px; }
  .sep  { grid-column: 1/-1; height: 1px; background: #D5D3CF; margin: 8px 0; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .card img { width: 96px; height: 96px; border-radius: 20px; box-shadow: 0 2px 14px rgba(0,0,0,.18); }
  .sym  { font-size: 11px; font-weight: 700; color: #B8832A; letter-spacing:.06em; }
  .lbl  { font-size: 12px; font-weight: 600; color: #37352F; text-align:center; line-height:1.3; }
  .col  { font-size: 11px; color: #999; }
</style>
</head>
<body>
<h1>앱 아이콘 — 디자인 비교</h1>
<p>심볼 4가지 × 색상 3가지 (차콜 / 코발트 / 웜다크)</p>
<div class="grid">
  ${SYMBOLS.map((sym, si) => {
    const cols = COLORS.map((col) => {
      const name = `prev-${sym.key}-${col.key}`
      return `<div class="card">
        <img src="${name}.png">
        <span class="sym">${sym.key}</span>
        <span class="lbl">${sym.label}</span>
        <span class="col">${col.label}</span>
      </div>`
    }).join('')
    return cols + (si < SYMBOLS.length - 1 ? '<div class="sep"></div>' : '')
  }).join('')}
</div>
</body>
</html>`

writeFileSync(path.join(outDir, 'icon-preview.html'), html)
console.log('\n✅ 완료!')
