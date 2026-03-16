import puppeteer from 'puppeteer';

/**
 * @typedef {import('puppeteer').Browser} Browser
 * @typedef {import('puppeteer').Page} Page
 */

/**
 * @param {{
 * 	browser?: Browser | null
 * 	onReady: (page: Page) => Promise<void>
 * 	targetUrl: string
 * 	wait?: (page: Page) => any
 * }} options
 * @returns {Promise<{ page: Page }>}
 */
export async function openViaProxy({ browser, targetUrl, wait, onReady }) {
	const ownBrowser = browser == null;
	browser ??= await puppeteer.connect({
		browserURL: 'http://localhost:9223',
		defaultViewport: null,
	});

	const page = await browser.newPage();
	await navigateViaProxy(page, targetUrl);
	await wait?.(page);
	await onReady?.(page);

	console.log('Task completed on target page:', page.url());
	if (ownBrowser) browser.disconnect();

	return { page };
}

/**
 * Đặc thù của proxyium — cập nhật tại đây khi trang đổi cơ chế.
 * @param {Page} page
 * @param {string} targetUrl
 */
async function navigateViaProxy(page, targetUrl) {
	await page.goto('https://proxyium.com/', { waitUntil: 'domcontentloaded' });
	await page.waitForSelector("input[type='text']");

	await page.evaluate((url) => (document.querySelector("input[type='text']").value = url), targetUrl);
	await page.evaluate(() => document.querySelector('form').submit());

	await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
}
