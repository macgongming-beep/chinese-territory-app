const { chromium } = require('playwright');
const fs = require('fs');

async function debugInspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('meeting-search') || url.includes('api/meeting')) {
      try {
        const json = await res.json();
        if (json && json.items && json.items.length > 0) {
          console.log('--- SAMPLE ITEM KEYS ---');
          console.log(Object.keys(json.items[0]));
          console.log('--- SAMPLE ITEM SAMPLE ---');
          console.log(JSON.stringify(json.items[0], null, 2));
        }
      } catch (e) {}
    }
  });

  await page.goto('https://hub.jw.org/meetings/ko?q=%7B%22meetingType%22:%22meetings%22,%22location%22:%22%EC%84%9C%EC%9A%B8%22%7D', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await browser.close();
}

debugInspect();
