// @ts-check

import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'

import { createLogger } from './logger.mjs'
import { getResult, triggerGenerate } from './evals.mjs'
import { waitForGenerateTaskID, waitForSubtitles, waitForUploadDone, waitForUploadTaskID } from './net-await.mjs'
import { blockTrackingScript } from './net-block.mjs'

/** @type {import('puppeteer').Browser | null} */
let sharedBrowser = null

/** @type {Promise<import('puppeteer').Browser> | null} */
let browserLaunchPromise = null

async function getBrowser() {
	// Nếu browser đã sống → dùng luôn
	if (sharedBrowser?.connected) return sharedBrowser

	// Nếu đang launch → chờ promise đó thay vì launch thêm
	if (browserLaunchPromise) return browserLaunchPromise

	// Chưa ai launch → ta launch, lưu promise để các caller khác chờ chung
	browserLaunchPromise = puppeteer
		.launch({
			headless: true,
			defaultViewport: { width: 0, height: 0 },
			args: [
				'--disable-setuid-sandbox',
				'--disable-dev-shm-usage',
				'--disable-extensions',
				'--disable-background-networking',
				'--disable-background-timer-throttling',
				'--disable-renderer-backgrounding',
				'--disable-gpu',
			],
		})
		.then((browser) => {
			sharedBrowser = browser

			// Nếu browser crash/đóng → reset để lần sau có thể launch lại
			browser.on('disconnected', () => {
				sharedBrowser = null
				browserLaunchPromise = null
			})

			return browser
		})
		.catch((err) => {
			// Launch thất bại → reset để cho phép thử lại
			browserLaunchPromise = null
			throw err
		})

	return browserLaunchPromise
}

/**
 * Process one audio file.
 *
 * @param {string} audioFile Absolute path
 * @returns {Promise<void>}
 */
export async function processAudio(audioFile) {
	const baseName = path.basename(audioFile, path.extname(audioFile))
	const outDir = path.join(path.dirname(audioFile), 'vtt')
	const output1 = path.join(outDir, `${baseName}.txt`)
	const output2 = path.join(outDir, `${baseName}.raw.txt`)
	if (fs.existsSync(output1) && fs.existsSync(output2)) return

	const logger = createLogger(audioFile)

	for (let attempt = 1; attempt <= 2; attempt++) {
		/** @type {import('puppeteer').BrowserContext | null} */
		let context = null

		try {
			logger.log(`Start processing (attempt ${attempt})`)

			const browser = await getBrowser()
			context = await browser.createBrowserContext()
			const page = await context.newPage()

			await blockTrackingScript(page)
			await page.goto('https://reccloud.com/ai-subtitle?v=product', { waitUntil: 'load' })

			const [fileChooser] = await Promise.all([
				page.waitForFileChooser(),
				// @ts-expect-error: Element type too large
				page.$eval('[data-v-f9a0b884].gradient-button-auto-theme', (el) => el.click()),
			])

			await fileChooser.accept([audioFile])
			logger.log('File selected')

			const uploadTaskID = await waitForUploadTaskID(page, logger)
			await waitForUploadDone(page, uploadTaskID, logger)

			await triggerGenerate(page)

			const genTaskID = await waitForGenerateTaskID(page)
			await waitForSubtitles(page, genTaskID, logger)

			const { origin, translation } = await getResult(page)

			fs.mkdirSync(outDir, { recursive: true })
			fs.writeFileSync(output2, origin, 'utf-8')
			fs.writeFileSync(output1, translation, 'utf-8')

			logger.log('SUCCESS')
			logger.close()
			return
		} catch (err) {
			logger.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`)

			if (attempt === 2) {
				logger.log('FAILED after retry')
				logger.close()
			}
		} finally {
			if (context) await context.close()
		}
	}
}
