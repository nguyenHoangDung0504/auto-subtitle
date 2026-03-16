/**
 * @param {import('puppeteer').Page} page
 */
export async function blockTrackingScript(page) {
	await page.setRequestInterception(true)
	const blockList = ['google-analytics.com', 'googletagmanager.com', 'hotjar.com', 'facebook.com/tr']
	page.on('request', (req) => (blockList.some((p) => req.url().includes(p)) ? req.abort() : req.continue()))
}
