const { chromium } = require('playwright');
const fs = require('fs');

const CSV_PATH = '/Users/gm/Documents/New project/chinese-territory-app/전국_왕국회관_공유회중_수집.csv';

async function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function scrapeKorea() {
  console.log('🚀 대한민국 전역 왕국회관 및 공유회중 전수 수집 시작 (Rate Limit 자동 대기 적용)...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Initialize session on hub.jw.org
  await page.goto('https://hub.jw.org/meetings/ko?q=%7B%22meetingType%22:%22meetings%22,%22location%22:%22%EC%84%9C%EC%9A%B8%22%7D', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Generate grid covering South Korea (33.1N ~ 38.5N, 126.1E ~ 129.5E)
  const boxes = [];
  const latStep = 0.35;
  const lngStep = 0.35;

  for (let lat = 33.1; lat <= 38.5; lat += latStep) {
    for (let lng = 126.1; lng <= 129.5; lng += lngStep) {
      const swLat = lat;
      const swLng = lng;
      const neLat = lat + latStep;
      const neLng = lng + lngStep;
      const cLat = (swLat + neLat) / 2;
      const cLng = (swLng + neLng) / 2;

      boxes.push({
        swLat: swLat.toFixed(4),
        swLng: swLng.toFixed(4),
        neLat: neLat.toFixed(4),
        neLng: neLng.toFixed(4),
        cLat: cLat.toFixed(4),
        cLng: cLng.toFixed(4)
      });
    }
  }

  console.log(`📍 총 ${boxes.length}개 지리적 격자 구역 탐색 예정...`);

  const hallMap = new Map();

  function saveCsv() {
    const csvRows = [["회관_ID", "주소", "좌표", "공유_회중_수", "함께_사용하는_회중_목록"]];
    hallMap.forEach((data) => {
      const congList = Array.from(data.congs);
      csvRows.push([
        `"${data.id}"`,
        `"${data.address.replace(/"/g, '""')}"`,
        `"${data.coords}"`,
        congList.length,
        `"${congList.join(' | ').replace(/"/g, '""')}"`
      ]);
    });
    const csvContent = "\uFEFF" + csvRows.map(r => r.join(",")).join("\n");
    fs.writeFileSync(CSV_PATH, csvContent, 'utf8');
  }

  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    const url = `https://hub.jw.org/meetings/api/meeting-search?first=100&northEastLatitude=${box.neLat}&northEastLongitude=${box.neLng}&southWestLatitude=${box.swLat}&southWestLongitude=${box.swLng}&searchLatitude=${box.cLat}&searchLongitude=${box.cLng}&eventTypes=congregation&eventTypes=congregationGroup&siteLanguageGuid=471312c0-84ad-4f87-bc1b-9f605b1855bf`;

    let success = false;
    let attempts = 0;

    while (!success && attempts < 5) {
      attempts++;
      try {
        const response = await page.evaluate(async (apiUrl) => {
          const r = await fetch(apiUrl, {
            headers: {
              'X-Requested-With': 'cdh-application',
              'Accept-Language': 'ko',
              'Accept': 'application/json'
            }
          });
          const text = await r.text();
          return { status: r.status, text };
        }, url);

        if (response.status === 429 || response.text.includes("Rate limit")) {
          console.warn(`[⚠️ Rate Limit] 격자 (${box.cLat}, ${box.cLng}) - 8초 대기 후 재시도 (${attempts}/5)...`);
          await sleep(8000);
          continue;
        }

        const json = JSON.parse(response.text);
        const items = json?.items || [];
        success = true;

        console.log(`[${i+1}/${boxes.length}] 격자 (${box.cLat}, ${box.cLng}) -> ${items.length}개 회관 (누적 고유회관: ${hallMap.size}개)`);

        for (const item of items) {
          const hallId = item.id;
          const lat = item.latitude;
          const lng = item.longitude;

          const congMeetings = item.congregationMeetings || [];
          const groupMeetings = item.congregationGroupMeetings || [];

          let primaryAddress = '주소 정보 미기재';
          const congs = [];

          for (const m of congMeetings) {
            if (m.address && primaryAddress === '주소 정보 미기재') {
              primaryAddress = m.address.trim().replace(/\r\n/g, ' ').replace(/\n/g, ' ');
            }
            const congName = m.name || m.transliteratedName || '이름없음';
            const phone = m.phoneNumber ? ` (📞 ${m.phoneNumber})` : '';
            congs.push(`${congName}${phone}`);
          }

          for (const g of groupMeetings) {
            const gName = g.name || '집단';
            congs.push(`[집단] ${gName}`);
          }

          if (!hallMap.has(hallId)) {
            hallMap.set(hallId, {
              id: hallId,
              address: primaryAddress,
              coords: `${lat}, ${lng}`,
              congs: new Set()
            });
          }

          const entry = hallMap.get(hallId);
          if (entry.address === '주소 정보 미기재' && primaryAddress !== '주소 정보 미기재') {
            entry.address = primaryAddress;
          }
          congs.forEach(c => entry.congs.add(c));
        }

        saveCsv();

      } catch (err) {
        console.error(`[오류] 격자 (${box.cLat}, ${box.cLng}) :`, err.message);
        await sleep(3000);
      }
    }

    // Rate limit prevention delay
    await sleep(1500);
  }

  console.log(`\n🎉 전국 수집 완료! 총 고유 왕국회관 건물: ${hallMap.size}개 수집됨`);
  saveCsv();
  console.log(`💾 엑셀 파일 저장 완료: ${CSV_PATH}`);
  await browser.close();
}

scrapeKorea().catch(console.error);
