const { chromium } = require('playwright');

async function testInput() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async res => {
    if (res.url().includes('meeting-search')) {
      console.log('API URL called:', res.url());
      try {
        const json = await res.json();
        console.log('Items returned:', json.items?.length);
      } catch (e) {}
    }
  });

  await page.goto('https://hub.jw.org/meetings/ko', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const inputSelector = 'input';
  await page.waitForSelector(inputSelector);
  console.log('Filling input with 서울...');
  await page.fill(inputSelector, '서울');
  await page.waitForTimeout(1500);

  // Check dropdown options
  const options = await page.$$('[role="option"], .mat-option, .option, li');
  console.log('Dropdown options count:', options.length);
  if (options.length > 0) {
    const text = await options[0].innerText();
    console.log('Clicking option 0:', text);
    await options[0].click();
  } else {
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(4000);
  await browser.close();
}

testInput().catch(console.error);
