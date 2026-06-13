/**
 * @typedef {import('puppeteer').Page} Page
 * @typedef {import('./logger.mjs').Logger} Logger
 */

/**
 * @param {Page} page
 * @param {number} [timeout=2 * 60 * 1000]
 * @returns {Promise<string>}
 */
export async function waitForTranslationTaskID(page, timeout = 2 * 60 * 1000) {
	return new Promise((resolve, reject) => {
		let timer = null
		let settled = false

		function cleanup() {
			if (settled) return
			settled = true
			clearTimeout(timer)
			page.off('response', onResponse)
			page.off('close', onClose)
		}

		timer = setTimeout(() => {
			cleanup()
			reject(new Error('waitForTranslationTaskID timeout'))
		}, timeout)

		async function onResponse(r) {
			if (!r.url().endsWith('/translations/batch')) return
			try {
				const json = await r.json()
				const taskId = json?.data?.task_id
				if (!taskId) return
				cleanup()
				console.log('Translation task_id:', taskId)
				resolve(taskId)
			} catch {
				// ignore parse error
			}
		}

		function onClose() {
			cleanup()
			reject(new Error('Page closed unexpectedly'))
		}

		page.on('response', onResponse)
		page.once('close', onClose)
	})
}

/**
 * @param {Page} page
 * @param {string} taskId
 * @param {Logger} logger
 * @param {number} [idleTimeout=5 * 60 * 1000]
 * @returns {Promise<void>}
 */
export async function waitForTranslationDone(page, taskId, logger, idleTimeout = 5 * 60 * 1000) {
	const start = Date.now()

	await new Promise((resolve, reject) => {
		let idleTimer = null
		let settled = false

		function cleanup() {
			if (settled) return
			settled = true
			clearTimeout(idleTimer)
			page.off('response', onResponse)
			page.off('close', onClose)
		}

		function resetIdleTimer() {
			clearTimeout(idleTimer)
			idleTimer = setTimeout(() => {
				cleanup()
				reject(new Error(`No translation progress for ${idleTimeout / 1000}s`))
			}, idleTimeout)
		}

		async function onResponse(r) {
			if (!r.url().includes(`/translations/batch/${taskId}`)) return

			resetIdleTimer()

			try {
				const json = await r.json()
				const data = json?.data

				if (typeof data?.progress === 'number') {
					logger.logProgress('Translating', data.progress)
				}

				if (data?.progress === 100) {
					cleanup()
					resolve()
				}
			} catch (err) {
				logger.log(`WARN onResponse parse error: ${err?.message}`)
			}
		}

		function onClose() {
			cleanup()
			reject(new Error('Page closed unexpectedly'))
		}

		page.on('response', onResponse)
		page.once('close', onClose)
		resetIdleTimer()
	})

	const duration = ((Date.now() - start) / 1000).toFixed(2)
	logger.log(`Translation completed in ${duration}s`)
}

// /**
//  * @typedef {import('puppeteer').Page} Page
//  * @typedef {import('./logger.mjs').Logger} Logger
//  */

// /**
//  * Bắt response /translations/batch → lấy task_id.
//  * Phải được gọi trước triggerGenerate để tránh miss response.
//  *
//  * @param {Page} page
//  * @param {number} [timeout=2 * 60 * 1000]
//  * @returns {Promise<string>}
//  */
// export async function waitForTranslationTaskID(page, timeout = 2 * 60 * 1000) {
// 	const res = await page.waitForResponse(
// 		async (r) => {
// 			if (!r.url().endsWith('/translations/batch')) return false
// 			try {
// 				const json = await r.json()
// 				return Boolean(json?.data?.task_id)
// 			} catch {
// 				return false
// 			}
// 		},
// 		{ timeout },
// 	)

// 	const json = await res.json()
// 	const taskId = json.data.task_id
// 	console.log('Translation task_id:', taskId)
// 	return taskId
// }

// /**
//  * Lắng nghe response /translations/batch/{taskId} do trang tự poll,
//  * đợi đến khi progress = 100.
//  *
//  * @param {Page} page
//  * @param {string} taskId
//  * @param {Logger} logger
//  * @param {number} [idleTimeout=5 * 60 * 1000]
//  * @returns {Promise<void>}
//  */
// export async function waitForTranslationDone(page, taskId, logger, idleTimeout = 5 * 60 * 1000) {
// 	const start = Date.now()

// 	await new Promise((resolve, reject) => {
// 		let idleTimer = null
// 		let settled = false

// 		function cleanup() {
// 			if (settled) return
// 			settled = true
// 			clearTimeout(idleTimer)
// 			page.off('response', onResponse)
// 		}

// 		function resetIdleTimer() {
// 			clearTimeout(idleTimer)
// 			idleTimer = setTimeout(() => {
// 				cleanup()
// 				reject(new Error(`No translation progress for ${idleTimeout / 1000}s`))
// 			}, idleTimeout)
// 		}

// 		async function onResponse(r) {
// 			if (!r.url().includes(`/translations/batch/${taskId}`)) return

// 			resetIdleTimer()

// 			try {
// 				const json = await r.json()
// 				const data = json?.data

// 				if (typeof data?.progress === 'number') {
// 					logger.logProgress('Translating', data.progress)
// 				}

// 				if (data?.progress === 100) {
// 					cleanup()
// 					resolve()
// 				}
// 			} catch {
// 				// ignore parse error
// 				logger.log(`WARN onResponse parse error: ${err?.message}`)
// 			}
// 		}

// 		page.on('response', onResponse)
// 		resetIdleTimer()
// 	})

// 	const duration = ((Date.now() - start) / 1000).toFixed(2)
// 	logger.log(`Translation completed in ${duration}s`)
// }
