import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/icons')
mkdirSync(outDir, { recursive: true })

const CHARCOAL  = '#1A1A1A'
const COBALT    = '#1848A8'
const WARM_DARK = '#2D2926'
const FOREST    = '#1B3A2D'   // 추가: 딥 포레스트 그린

const W    = 'rgba(255,255,255,0.95)'
const W_MD = 'rgba(255,255,255,0.55)'
const W_DM = 'rgba(255,255,255,0.20)'

// ── E: 회전된 두 사각형 겹침 ────────────────────────────────
// 두 스퀘어가 엇갈려 겹쳐 역동적인 X 형태 — 추상 마크
function crossSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <rect x="148" y="148" width="216" height="216" rx="32"
        fill="${W_DM}" transform="rotate(22 256 256)"/>
  <rect x="148" y="148" width="216" height="216" rx="32"
        fill="${W_DM}" transform="rotate(-22 256 256)"/>
  <!-- 중심 강조 -->
  <rect x="148" y="148" width="216" height="216" rx="32"
        fill="none" stroke="${W}" stroke-width="18"
        transform="rotate(22 256 256)" opacity="0.7"/>
  <rect x="148" y="148" width="216" height="216" rx="32"
        fill="none" stroke="${W}" stroke-width="18"
        transform="rotate(-22 256 256)" opacity="0.7"/>
  <circle cx="256" cy="256" r="24" fill="${W}"/>
</svg>`
}

// ── F: 링 + 오프센터 닷 ────────────────────────────────────
// 두꺼운 원형 링 + 안쪽 작은 원 = 구역 안의 포인트
function ringSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 외부 링 -->
  <circle cx="256" cy="256" r="140" fill="none"
          stroke="${W}" stroke-width="38" opacity="0.9"/>
  <!-- 링 안 오프센터 닷 (우상단쪽) -->
  <circle cx="306" cy="200" r="34" fill="${W}"/>
  <!-- 닷에서 링 중심으로 이어지는 가는 선 -->
  <line x1="282" y1="222" x2="256" y2="256"
        stroke="${W}" stroke-width="14" stroke-linecap="round" opacity="0.4"/>
</svg>`
}

// ── G: 접힌 카드 모서리 (Map Fold) ────────────────────────
// 카드 우상단이 접힌 형태 = 지도/카드 메타포
function foldSVG(bg) {
  // 카드: 좌상(108,152) 우상(396,152) 우하(396,360) 좌하(108,360)
  // 접히는 삼각 크기: 90px
  const F = 90
  // 접힌 부분: (396-F, 152), (396, 152), (396, 152+F)
  // 접힌 후: 꺾인 삼각의 뒷면은 살짝 어두운 흰색
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 카드 본체 (모서리 잘린 형태로) -->
  <polygon
    points="124,152 306,152 396,242 396,362 124,362"
    fill="${W}" opacity="0.92"/>
  <!-- 접힌 삼각 구멍 (bg 색으로 덮어 모서리 제거) -->
  <polygon points="306,152 396,152 396,242" fill="${bg}"/>
  <!-- 접힌 면 (뒤집어진 삼각, 살짝 어둡게) -->
  <polygon points="306,152 396,242 306,242" fill="${W}" opacity="0.28"/>
  <!-- 카드 위 수평선 (내용 느낌) -->
  <rect x="154" y="222" width="120" height="12" rx="6" fill="${bg}" opacity="0.15"/>
  <rect x="154" y="244" width="168" height="10" rx="5" fill="${bg}" opacity="0.10"/>
  <rect x="154" y="263" width="96" height="10" rx="5" fill="${bg}" opacity="0.10"/>
</svg>`
}

// ── H: 세 줄 스택 (Three Bars) ─────────────────────────────
// 길이가 줄어드는 우정렬 바 3개 = 구역 계층/드릴다운 느낌
// 미니멀 로고로 가장 독특한 형태
function barsSVG(bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}"/>
  <!-- 1번 바 (가장 길, 전폭) -->
  <rect x="106" y="184" width="300" height="34" rx="17" fill="${W}"/>
  <!-- 2번 바 (우정렬, 중간 길이) -->
  <rect x="176" y="239" width="230" height="34" rx="17" fill="${W}" opacity="0.6"/>
  <!-- 3번 바 (우정렬, 짧음) -->
  <rect x="246" y="294" width="160" height="34" rx="17" fill="${W}" opacity="0.3"/>
</svg>`
}

// ── 생성 목록 ───────────────────────────────────────────────
const COLORS = [
  { key: 'charcoal', bg: CHARCOAL,  label: '차콜' },
  { key: 'cobalt',   bg: COBALT,    label: '코발트' },
  { key: 'warm',     bg: WARM_DARK, label: '웜다크' },
  { key: 'forest',   bg: FOREST,    label: '포레스트' },
]

const SYMBOLS = [
  { key: 'E', label: '교차 사각형',    fn: crossSVG },
  { key: 'F', label: '링 + 닷',        fn: ringSVG },
  { key: 'G', label: '접힌 카드',      fn: foldSVG },
  { key: 'H', label: '세 줄 바',       fn: barsSVG },
]

const designs = []
for (const sym of SYMBOLS) {
  for (const col of COLORS) {
    const name = `prev2-${sym.key}-${col.key}`
    designs.push({ name, svg: sym.fn(col.bg), sym, col })
  }
}

for (const { name, svg } of designs) {
  const out = path.join(outDir, `${name}.png`)
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(out)
  process.stdout.write(`✓ ${name}\n`)
}

// ── HTML ────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>아이콘 비교 2차</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, sans-serif; background: #EDECE9; padding: 40px 32px 80px; }
  h1 { font-size: 18px; font-weight: 700; color: #1A1A1A; margin-bottom: 6px; }
  p  { font-size: 13px; color: #888; margin-bottom: 36px; }
  .section { margin-bottom: 40px; }
  .section h2 { font-size: 11px; font-weight: 700; color: #B8832A; letter-spacing:.1em;
                text-transform: uppercase; margin-bottom: 14px; }
  .row { display: flex; gap: 14px; }
  .card { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .card img { width: 96px; height: 96px; border-radius: 20px;
              box-shadow: 0 3px 16px rgba(0,0,0,.2); }
  .lbl { font-size: 11px; color: #999; }
</style>
</head>
<body>
<h1>아이콘 2차 비교 — 완전 다른 느낌</h1>
<p>E·F·G·H 4가지 심볼 × 차콜 / 코발트 / 웜다크 / 포레스트</p>
${SYMBOLS.map(sym => `
<div class="section">
  <h2>${sym.key} — ${sym.label}</h2>
  <div class="row">
    ${COLORS.map(col => `
    <div class="card">
      <img src="prev2-${sym.key}-${col.key}.png">
      <span class="lbl">${col.label}</span>
    </div>`).join('')}
  </div>
</div>`).join('')}
</body>
</html>`

writeFileSync(path.join(outDir, 'icon-preview2.html'), html)
console.log('\n✅ open public/icons/icon-preview2.html')
