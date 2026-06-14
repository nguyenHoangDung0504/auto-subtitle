// @ts-check

import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'

import { createLogger } from './logger.mjs'
import { getResult, triggerGenerate } from './evals.mjs'
import { waitForTranslationTaskID, waitForTranslationDone } from './net-await.mjs'
import { blockTrackingScript } from '../net-block.mjs'
import { getAudioDuration, cutAudio, getChunkPaths, loadState, saveState, getLastCueEnd, mergeVTT } from './chunk.mjs'

const TWENTY_MINUTES = 20 * 60 // seconds

/** @type {import('puppeteer').Browser | null} */
let sharedBrowser = null

/** @type {Promise<import('puppeteer').Browser> | null} */
let browserLaunchPromise = null

async function getBrowser() {
	if (sharedBrowser?.connected) return sharedBrowser
	if (browserLaunchPromise) return browserLaunchPromise

	browserLaunchPromise = puppeteer
		.launch({
			// headless: false,
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
 * Upload một audio file lên reccloud và lấy kết quả VTT.
 *
 * @param {string} audioFile
 * @param {number} offset seconds
 * @param {import('./logger.mjs').Logger} logger
 * @returns {Promise<{ origin: string, translation: string }>}
 */
async function uploadAndGetVTT(audioFile, offset, logger) {
	for (let attempt = 1; attempt <= 2; attempt++) {
		/** @type {import('puppeteer').BrowserContext | null} */
		let context = null

		try {
			logger.log(`Uploading ${path.basename(audioFile)} (attempt ${attempt})`)

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

			const taskIdPromise = waitForTranslationTaskID(page)
			await triggerGenerate(page)

			const translationTaskID = await taskIdPromise
			await waitForTranslationDone(page, translationTaskID, logger)

			const result = await getResult(page, translationTaskID, offset)

			return result
		} catch (err) {
			logger.log(`ERROR [attempt ${attempt}]: ${err instanceof Error ? err.stack : String(err)}`)
			if (attempt === 2) throw err
		} finally {
			if (context) await context.close()
		}
	}

	throw new Error('unreachable')
}

/**
 * Process one audio file, tự động chunk nếu > 20 phút.
 *
 * @param {string} audioFile Absolute path
 * @returns {Promise<void>}
 */
export async function processAudio(audioFile) {
	const baseName = path.basename(audioFile, path.extname(audioFile))
	const outDir = path.join(path.dirname(audioFile), 'vtt')
	const outputTxt = path.join(outDir, `${baseName}.txt`)
	const outputRaw = path.join(outDir, `${baseName}.raw.txt`)

	// Đã xong hoàn toàn
	if (fs.existsSync(outputTxt) && fs.existsSync(outputRaw)) return

	const logger = createLogger(audioFile)

	try {
		const duration = getAudioDuration(audioFile)
		logger.log(`Duration: ${duration.toFixed(1)}s`)

		// File ngắn: flow cũ, không cần chunking
		if (duration < TWENTY_MINUTES) {
			logger.log('Short file, processing directly')
			const { origin, translation } = await uploadAndGetVTT(audioFile, 0, logger)
			fs.mkdirSync(outDir, { recursive: true })
			fs.writeFileSync(outputRaw, origin, 'utf-8')
			fs.writeFileSync(outputTxt, translation, 'utf-8')
			logger.log('SUCCESS')
			logger.close()
			return
		}

		// File dài: chunking flow
		logger.log('Long file, chunking mode')
		const { stateFile, chunkDir, vttChunkDir } = getChunkPaths(audioFile)

		/** @type {import('./chunk.mjs').ChunkState} */
		let state = loadState(stateFile) ?? {
			parts: [],
			merged: false,
		}

		if (state.merged) {
			// State nói đã merge nhưng output không có → state bị corrupt
			logger.log('State says merged but output missing, resetting merge flag')
			state.merged = false
			saveState(stateFile, state)
		}

		// Resume: xác định part tiếp theo cần xử lý
		// Part đầu tiên luôn là file gốc, offset = 0
		if (state.parts.length === 0) {
			state.parts.push({
				index: 1,
				sourceAudio: audioFile,
				offset: 0,
				vttReady: false,
			})
			saveState(stateFile, state)
		}

		// Loop xử lý từng part
		while (true) {
			const currentPart = state.parts[state.parts.length - 1]

			// VTT của part này chưa có → upload và lấy
			if (!currentPart.vttReady) {
				const partVttTxt = path.join(vttChunkDir, `part${currentPart.index}.txt`)
				const partVttRaw = path.join(vttChunkDir, `part${currentPart.index}.raw.txt`)

				const { origin, translation } = await uploadAndGetVTT(
					currentPart.sourceAudio,
					currentPart.offset,
					logger,
				)

				fs.mkdirSync(vttChunkDir, { recursive: true })
				fs.writeFileSync(partVttRaw, origin, 'utf-8')
				fs.writeFileSync(partVttTxt, translation, 'utf-8')

				currentPart.vttReady = true
				saveState(stateFile, state)

				logger.log(`Part ${currentPart.index} VTT ready`)
			}

			// Đọc VTT để lấy cutAt
			const partVttRaw = path.join(vttChunkDir, `part${currentPart.index}.raw.txt`)
			const vttContent = fs.readFileSync(partVttRaw, 'utf-8')
			const lastCueEnd = getLastCueEnd(vttContent) // seconds, relative to chunk start

			// cutAt tính theo absolute time (offset + lastCueEnd)
			const cutAt = currentPart.offset + lastCueEnd

			// Kiểm tra còn audio sau cutAt không
			const remaining = duration - cutAt
			logger.log(
				`Part ${currentPart.index} cutAt: ${cutAt.toFixed(1)}s, remaining: ${Math.max(0, remaining).toFixed(1)}s`,
			)

			if (remaining <= 1) {
				// Không còn gì sau cutAt → đây là part cuối
				logger.log('No remaining audio, proceeding to merge')
				break
			}

			// Còn audio → cắt chunk tiếp
			const nextIndex = currentPart.index + 1
			const nextAudio = path.join(chunkDir, `part${nextIndex}${path.extname(audioFile)}`)

			if (!fs.existsSync(nextAudio)) {
				logger.log(`Cutting part ${nextIndex} from ${cutAt.toFixed(1)}s`)
				cutAudio(audioFile, cutAt, nextAudio)
			}

			const nextDuration = getAudioDuration(nextAudio)
			logger.log(`Part ${nextIndex} duration: ${nextDuration.toFixed(1)}s`)

			// Thêm part mới vào state nếu chưa có
			const alreadyExists = state.parts.find((p) => p.index === nextIndex)
			if (!alreadyExists) {
				state.parts.push({
					index: nextIndex,
					sourceAudio: nextAudio,
					offset: cutAt,
					vttReady: false,
				})
				saveState(stateFile, state)
			}

			// Nếu chunk tiếp theo < 20p → nó sẽ là part cuối, loop tiếp để xử lý
			// Nếu >= 20p → reccloud sẽ tự giới hạn lại, loop tiếp xử lý bình thường
		}

		// Tất cả parts đã có VTT → merge
		logger.log(`Merging ${state.parts.length} parts`)

		// Đọc tất cả VTT theo thứ tự, dùng raw (origin) để merge riêng, translation để merge riêng
		const originParts = []
		const translationParts = []

		for (const part of state.parts) {
			const partVttRaw = path.join(vttChunkDir, `part${part.index}.raw.txt`)
			const partVttTxt = path.join(vttChunkDir, `part${part.index}.txt`)
			// VTT đã được offset sẵn khi ghi (getResult nhận offset)
			// Nên khi merge chỉ cần ghép cues, không cần offset lại
			originParts.push({ content: fs.readFileSync(partVttRaw, 'utf-8'), offset: 0 })
			translationParts.push({ content: fs.readFileSync(partVttTxt, 'utf-8'), offset: 0 })
		}

		const mergedOrigin = mergeVTT(originParts)
		const mergedTranslation = mergeVTT(translationParts)

		fs.mkdirSync(outDir, { recursive: true })
		fs.writeFileSync(outputRaw, mergedOrigin, 'utf-8')
		fs.writeFileSync(outputTxt, mergedTranslation, 'utf-8')

		state.merged = true
		saveState(stateFile, state)

		logger.log('SUCCESS')
		logger.close()
		console.log('SUCCESS:', outputTxt)
	} catch (err) {
		logger.log(`FAILED: ${err instanceof Error ? err.stack : String(err)}`)
		logger.close()
		console.log('FAILED:', audioFile)
	}
}
