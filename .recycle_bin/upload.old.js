import path from 'path'
import fs from 'fs'
import puppeteer from 'puppeteer'
import getResult from './getResult.js'

/* ============================================================
   NETWORK WAIT HELPERS
============================================================ */

// 1️⃣ Lấy upload task_id
async function waitForUploadTaskId(page, timeout = 5 * 60 * 1000) {
	return page
		.waitForResponse(
			async (res) => {
				if (!res.url().endsWith('/subtitles/language/recognition')) return false
				try {
					const json = await res.json()
					return !!json?.data?.task_id
				} catch {
					return false
				}
			},
			{ timeout },
		)
		.then(async (res) => {
			const json = await res.json()
			return json.data.task_id
		})
}

// 2️⃣ Đợi upload progress = 100
async function waitForUploadDone(page, taskId, timeout = 20 * 60 * 1000) {
	await page.waitForResponse(
		async (res) => {
			if (!res.url().endsWith(`/subtitles/language/recognition/${taskId}`)) return false
			try {
				const json = await res.json()
				const progress = json?.data?.progress
				if (progress !== undefined) {
					console.log(`  📤 Upload progress: ${progress}%`)
				}
				return progress === 100
			} catch {
				return false
			}
		},
		{ timeout },
	)
}

// 3️⃣ Lấy generate task_id (KHÁC upload task)
async function waitForGenerateTaskId(page, timeout = 5 * 60 * 1000) {
	return page
		.waitForResponse(
			async (res) => {
				if (!res.url().endsWith('/subtitles/recognition/v2')) return false
				try {
					const json = await res.json()
					return !!json?.data?.task_id
				} catch {
					return false
				}
			},
			{ timeout },
		)
		.then(async (res) => {
			const json = await res.json()
			return json.data.task_id
		})
}

// 4️⃣ Đợi subtitles != null
async function waitForSubtitles(page, taskId, timeout = 30 * 60 * 1000) {
	await page.waitForResponse(
		async (res) => {
			if (!res.url().endsWith(`/subtitles/recognition/v2/${taskId}`)) return false
			try {
				const json = await res.json()
				const data = json?.data

				if (data?.progress !== undefined) {
					console.log(`  🤖 Processing: ${data.progress}%`)
				}

				return Array.isArray(data?.subtitles)
			} catch {
				return false
			}
		},
		{ timeout },
	)
}

/* ============================================================
   PROCESS 1 AUDIO FILE
============================================================ */

async function processAudio(audioFile) {
	console.log(`\n🎵 Bắt đầu xử lý: ${audioFile}`)

	let browser

	try {
		browser = await puppeteer.launch({ headless: false })
		const [page] = await browser.pages()

		// Block analytics
		await page.setRequestInterception(true)
		const blockList = ['google-analytics.com', 'googletagmanager.com', 'hotjar.com', 'facebook.com/tr']

		page.on('request', (req) => {
			if (blockList.some((p) => req.url().includes(p))) {
				req.abort()
			} else {
				req.continue()
			}
		})

		await page.goto('https://reccloud.com/ai-subtitle?v=product')
		await new Promise((r) => setTimeout(r, 2000))

		// Upload file
		const [fileChooser] = await Promise.all([
			page.waitForFileChooser(),
			page.click('[data-v-f9a0b884].gradient-button-auto-theme'),
		])

		await fileChooser.accept([path.resolve(audioFile)])
		console.log(`✓ Đã chọn file, đang upload...`)

		// 🔥 UPLOAD TASK FLOW
		const uploadTaskId = await waitForUploadTaskId(page)
		console.log(`✓ uploadTaskId: ${uploadTaskId}`)

		await waitForUploadDone(page, uploadTaskId)
		console.log(`✓ Upload hoàn tất`)

		// Chờ UI render
		await page.waitForSelector('div[data-v-584aadf4].size-full.flex.flex-col', { timeout: 20000 })

		// Click generate
		await page.evaluate(async () => {
			const scope = document.querySelector('div[data-v-584aadf4].size-full.flex.flex-col')

			const btn = scope.querySelector('.cursor-pointer[style*="--start"]')
			btn.click()
			await new Promise((r) => setTimeout(r, 500))

			const wrappers = scope.querySelectorAll('div[data-v-584aadf4].w-full.mt-\\[8px\\]')

			const wrapper = wrappers[1]

			const dropdownTrigger = wrapper.querySelector('.flex.items-center.justify-between.w-full.h-full')

			;['mousedown', 'mouseup', 'click'].forEach((e) =>
				dropdownTrigger.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true })),
			)

			await new Promise((r) => setTimeout(r, 800))

			const list = wrapper.querySelector('[data-list-container-class]')
			const items = list.querySelectorAll('ul > li')

			const target = [...items].find((li) => li.textContent.trim().toLowerCase() === 'vietnamese')

			;['mousedown', 'mouseup', 'click'].forEach((e) =>
				target.dispatchEvent(new MouseEvent(e, { bubbles: true, cancelable: true })),
			)

			await new Promise((r) => setTimeout(r, 300))

			scope.querySelector('button[data-v-584aadf4].gradient-button-auto-theme').click()
		})

		console.log(`✓ Đã click Generate`)

		// 🔥 GENERATE TASK FLOW (task mới)
		const genTaskId = await waitForGenerateTaskId(page)
		console.log(`✓ genTaskId: ${genTaskId}`)

		await waitForSubtitles(page, genTaskId)
		console.log(`✓ Subtitle generate hoàn tất`)

		// Lấy kết quả
		const { origin, translation } = await getResult(page)

		// Ghi file
		const baseName = path.basename(audioFile, path.extname(audioFile))
		const outDir = path.join(path.dirname(audioFile), 'vtt')
		fs.mkdirSync(outDir, { recursive: true })

		const originPath = path.join(outDir, `${baseName}.raw.vtt`)
		fs.writeFileSync(originPath, origin, 'utf-8')
		console.log(`✓ Ghi: ${originPath}`)

		if (translation) {
			const translationPath = path.join(outDir, `${baseName}.vtt`)
			fs.writeFileSync(translationPath, translation, 'utf-8')
			console.log(`✓ Ghi: ${translationPath}`)
		}

		console.log(`[${audioFile}] Hoàn tất!`)
	} catch (err) {
		console.error(`[${audioFile}] Lỗi:`, err.message)
	} finally {
		if (browser) {
			await browser.close()
		}
	}
}

/* ============================================================
   WORKER POOL
============================================================ */

const AUDIO_DIR = './.audio'
const CONCURRENCY = 2

const audioFiles = fs
	.readdirSync(AUDIO_DIR)
	.filter((f) => ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'].includes(path.extname(f).toLowerCase()))
	.map((f) => path.join(AUDIO_DIR, f))

console.log(`Tìm thấy ${audioFiles.length} file audio`)

const queue = [...audioFiles]

async function worker(id) {
	while (queue.length > 0) {
		const file = queue.shift()
		if (!file) break

		console.log(`[Worker ${id}] Nhận task: ${file} (còn ${queue.length} trong queue)`)

		await processAudio(file)
	}
	console.log(`[Worker ${id}] Hết việc, dừng.`)
}

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)))

console.log('\nTất cả xong!')
process.exit(0)
