const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport size
  await page.setViewport({ width: 1280, height: 800 });

  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', request => console.log('BROWSER NETWORK ERROR:', request.url(), request.failure().errorText));

  console.log("Navigating to http://127.0.0.1/");
  await page.goto('http://127.0.0.1/', { waitUntil: 'networkidle0' });

  // Take a screenshot of the initial page
  await page.screenshot({ path: 'storefront.png' });
  console.log("Screenshot saved as storefront.png");

  // Wait for the Curated Products to appear
  await page.waitForSelector('.group.cursor-pointer');
  console.log("Found product cards");

  // Try to find the product card.
  const cards = await page.$$('.group.cursor-pointer');
  console.log(`Found ${cards.length} product cards`);

  if (cards.length > 0) {
    // Click the first card
    console.log("Clicking the first card...");
    await cards[0].evaluate(b => b.click());
        // Wait for the product detail heading (any h1) to appear
      try {
        await page.waitForSelector('h1', { timeout: 5000 });
        const productName = await page.$eval('h1', el => el.textContent.trim());
        console.log('Product detail loaded, name:', productName);
      } catch (e) {
        console.log('Product detail heading not found:', e.message);
      }

      // Wait for network idle or 2 seconds
      await new Promise(r => setTimeout(r, 2000));
        // Log the current URL after navigation
      const currentUrl = await page.evaluate(() => location.href);
      console.log('Current URL after click:', currentUrl);

      // Take a screenshot after navigation
      await page.screenshot({ path: 'after_click.png' });
      console.log('Screenshot saved as after_click.png');
  } else {
    console.log("No product cards found to click.");
  }

  await browser.close();
})();
