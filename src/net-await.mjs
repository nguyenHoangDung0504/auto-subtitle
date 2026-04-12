/**
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('./logger.mjs').Logger} Logger
 */

/**
 * Wait for upload task_id response.
 *
 * @param {Page} page
 * @param {Logger} logger
 * @param {number} [idleTimeout=5 * 60 * 1000]
 * @returns {Promise<string>}
 */
export async function waitForUploadTaskID(page, logger, idleTimeout = 5 * 60 * 1000) {
	return new Promise((resolve, reject) => {
		let idleTimer = null
		let domPollInterval = null
		let settled = false

		function cleanup() {
			if (settled) return
			settled = true
			clearTimeout(idleTimer)
			clearInterval(domPollInterval)
			page.off('request', onRequest)
			page.off('response', onResponse)
		}

		function resetIdleTimer() {
			clearTimeout(idleTimer)
			idleTimer = setTimeout(() => {
				cleanup()
				reject(new Error('Maybe bad network'))
			}, idleTimeout)
		}

		function onRequest(req) {
			const match = req.url().match(/[?&]partNumber=(\d+)/)
			if (match) {
				logger.log(`Uploaded part: ${match[1]}`)
				resetIdleTimer()
			}
		}

		async function onResponse(r) {
			if (!r.url().endsWith('/subtitles/language/recognition')) return
			try {
				const json = await r.json()
				const taskId = json?.data?.task_id
				if (!taskId) return
				cleanup()
				logger.log(`[Upload task ID]: ${taskId}`)
				resolve(taskId)
			} catch {
				// ignore parse error
			}
		}

		// Poll DOM mỗi 5s kiểm tra network error dialog
		domPollInterval = setInterval(async () => {
			try {
				const hasError = await page.evaluate(() => {
					const buttons = [...document.querySelectorAll('div[data-v-app] button')].map((el) =>
						el.textContent.trim(),
					)
					return buttons.join(',') === ',Cancel,Retry'
				})
				if (hasError) {
					cleanup()
					reject(new Error('Network Error'))
				}
			} catch {
				// page có thể đang navigate, bỏ qua
			}
		}, 5000)

		page.on('request', onRequest)
		page.on('response', onResponse)

		// Khởi động idle timer ngay từ đầu
		resetIdleTimer()
	})
}

/**
 * Wait until upload progress reaches 100%.
 *
 * @param {Page} page
 * @param {string} taskId
 * @param {Logger} logger
 * @param {number} [timeout=1200000]
 * @returns {Promise<void>}
 */
export async function waitForUploadDone(page, taskId, logger, timeout = 20 * 60 * 1000) {
	const start = Date.now()

	await page.waitForResponse(
		async (r) => {
			if (!r.url().endsWith(`/subtitles/language/recognition/${taskId}`)) return false
			try {
				const json = await r.json()
				const progress = Number(json?.data?.progress)
				return progress === 100
			} catch {
				return false
			}
		},
		{ timeout },
	)

	const duration = ((Date.now() - start) / 1000).toFixed(2)
	logger.log(`Upload completed in ${duration}s`)

	// Delay 2s to avoid bugs caused by incomplete UI rendering (maybe :))))
	await new Promise((resolve) => setTimeout(resolve, 2000))
}

/**
 * Wait for generate task_id.
 *
 * @param {Page} page
 * @param {number} [timeout=300000]
 * @returns {Promise<string>}
 */
export async function waitForGenerateTaskID(page, timeout = 5 * 60 * 1000) {
	const res = await page.waitForResponse(
		async (r) => {
			if (!r.url().endsWith('/subtitles/recognition/v2')) return false
			try {
				const json = await r.json()
				return Boolean(json?.data?.task_id)
			} catch {
				return false
			}
		},
		{ timeout },
	)

	const json = await res.json()
	const genTaskID = json.data.task_id
	console.log(`genTaskID:`, genTaskID)

	return genTaskID
}

/**
 * Wait until subtitles array is available.
 *
 * @param {Page} page
 * @param {string} taskId
 * @param {Logger} logger
 * @param {number} [idleTimeout=5 * 60 * 1000]
 */
export async function waitForSubtitles(page, taskId, logger, idleTimeout = 5 * 60 * 1000) {
	const start = Date.now()

	await new Promise((resolve, reject) => {
		let idleTimer = null
		let settled = false

		function cleanup() {
			if (settled) return
			settled = true
			clearTimeout(idleTimer)
			page.off('response', onResponse)
		}

		function resetIdleTimer() {
			clearTimeout(idleTimer)
			idleTimer = setTimeout(() => {
				cleanup()
				reject(new Error('No subtitle response for 5 minutes'))
			}, idleTimeout)
		}

		async function onResponse(r) {
			if (!r.url().endsWith(`/subtitles/recognition/v2/${taskId}`)) return

			// Thấy response match → reset idle timer
			resetIdleTimer()

			try {
				const json = await r.json()
				const data = json?.data

				if (typeof data?.progress === 'number') {
					logger.logProgress('Processing', data.progress)
				}

				if (Array.isArray(data?.subtitles) && data?.progress === 100) {
					cleanup()
					resolve()
				}
			} catch {
				// ignore parse error
			}
		}

		page.on('response', onResponse)
		resetIdleTimer()
	})

	const duration = ((Date.now() - start) / 1000).toFixed(2)
	logger.log(`Processing completed in ${duration}s`)
}
