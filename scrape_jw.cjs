const { chromium } = require('playwright');
const fs = require('fs');

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Network API response interceptor
  const allApiItems = [];

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('meeting-search') || url.includes('api/meeting')) {
      try {
        const json = await res.json();
        if (json && json.items) {
          console.log(`[API Captured] ${json.items.length} items from ${url.slice(0, 80)}`);
          allApiItems.push(...json.items);
        }
      } catch (e) {}
    }
  });

  console.log('Navigating to hub.jw.org...');
  await page.goto('https://hub.jw.org/meetings/ko?q=%7B%22meetingType%22:%22meetings%22,%22location%22:%22%EC%84%9C%EC%9A%B8%22%7D', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  // Search major cities / regions in Korea
  const regions = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산',
    '수원', '성남', '고양', '용인', '부천', '안산', '남양주',
    '안양', '평택', '의정부', '파주', '시흥', '김포', '광명',
    '원주', '춘천', '강릉', '청주', '충주', '천안', '아산',
    '전주', '익산', '군산', '목포', '여수', '순천', '포항',
    '구미', '창원', '김해', '양산', '제주'
  ];

  for (const region of regions) {
    console.log(`🔎 Searching region: ${region}...`);
    try {
      // Find search input field
      const input = await page.$('input[type="search"], input[type="text"], input');
      if (input) {
        await input.click();
        await input.fill(region);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        // Click search button if present
        const searchBtn = await page.$('button[type="submit"], button:has-text("검색")');
        if (searchBtn) {
          await searchBtn.click().catch(() => {});
          await page.waitForTimeout(2500);
        }
      }
    } catch (err) {
      console.log(`Error searching ${region}:`, err.message);
    }
  }

  console.log(`\n📊 Total raw API items collected: ${allApiItems.length}`);

  // Process and group items by location / address
  const hallMap = new Map();

  for (const item of allApiItems) {
    const locId = item.id || item.meetingLocationGuid || (item.address && item.address.formattedAddress);
    const address = (item.address && item.address.formattedAddress) || item.addressLine1 || item.name || '주소 정보 미기재';
    const coords = item.location ? `${item.location.latitude},${item.location.longitude}` : '';

    const congs = [];
    if (Array.isArray(item.congregationMeetings)) {
      for (const m of item.congregationMeetings) {
        if (m.congregationName) congs.push(`${m.congregationName} (${m.languageName || '한국어'})`);
      }
    }
    if (Array.isArray(item.congregationGroupMeetings)) {
      for (const g of item.congregationGroupMeetings) {
        if (g.congregationName) congs.push(`${g.congregationName} [집단] (${g.languageName || ''})`);
      }
    }

    const key = locId || address;
    if (!hallMap.has(key)) {
      hallMap.set(key, {
        id: item.id || '',
        address: address,
        coords: coords,
        congs: new Set()
      });
    }
    const record = hallMap.get(key);
    congs.forEach(c => record.congs.add(c));
  }

  // Format CSV
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

  const csvPath = '/Users/gm/Documents/New project/chinese-territory-app/전국_왕국회관_공유회중_수집.csv';
  const csvContent = "\uFEFF" + csvRows.map(r => r.join(",")).join("\n");
  fs.writeFileSync(csvPath, csvContent, 'utf8');

  console.log(`\n🎉 수집 완료! 파일 저장: ${csvPath}`);
  await browser.close();
}

scrape().catch(console.error);
