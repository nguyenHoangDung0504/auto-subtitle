// @ts-check

import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'

import { createLogger } from './logger.mjs'
import { getResult, triggerGenerate } from './evals.mjs'
import { waitForTranslationTaskID, waitForTranslationDone } from './net-await.mjs'
import { blockTrackingScript } from '../net-block.mjs'

/** @type {import('puppeteer').Browser | null} */
let sharedBrowser = null

/** @type {Promise<import('puppeteer').Browser> | null} */
let browserLaunchPromise = null

async function getBrowser() {
	if (sharedBrowser?.connected) return sharedBrowser

	if (browserLaunchPromise) return browserLaunchPromise

	browserLaunchPromise = puppeteer
		.launch({
			headless: false,
			defaultViewport: { width: 0, height: 0 },
			args: [],
		})
		.then((browser) => {
			sharedBrowser = browser

			browser.on('disconnected', () => {
				sharedBrowser = null
				browserLaunchPromise = null
			})

			return browser
		})
		.catch((err) => {
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
			await page.goto('https://reccloud.com/auto-subtitle-translator?v=product', { waitUntil: 'load' })

			const [fileChooser] = await Promise.all([
				page.waitForFileChooser(),
				page.$eval('div.gradient-button-auto-theme.flex-center.relative.z-10', (el) => el.click()),
			])

			await fileChooser.accept([audioFile])
			logger.log('File selected')

			// Bắt task_id trước, triggerGenerate sau để tránh miss response
			const taskIdPromise = waitForTranslationTaskID(page)

			await triggerGenerate(page)

			const translationTaskID = await taskIdPromise
			await waitForTranslationDone(page, translationTaskID, logger)

			const { origin, translation } = await getResult(page, translationTaskID)

			fs.mkdirSync(outDir, { recursive: true })
			fs.writeFileSync(output2, origin, 'utf-8')
			fs.writeFileSync(output1, translation, 'utf-8')

			logger.log('SUCCESS')
			logger.close()
			console.log('SUCCESS:', outDir + '/' + baseName)
			return
		} catch (err) {
			logger.log(`ERROR: ${err instanceof Error ? err.message : String(err)}`)

			if (attempt === 2) {
				logger.log('FAILED after retry')
				logger.close()
				console.log('FAILED:', outDir + '/' + baseName)
			}
		} finally {
			if (context) await context.close()
		}
	}
}
