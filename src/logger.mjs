// @ts-check

import fs from 'fs'
import path from 'path'

/**
 * @typedef {ReturnType<typeof createLogger>} Logger
 */

/**
 * Create file logger for one audio file.
 *
 * @param {string} audioFile Absolute path
 */
export function createLogger(audioFile) {
	const baseName = path.basename(audioFile, path.extname(audioFile))
	const reportDir = path.join(path.dirname(audioFile), 'report')

	fs.mkdirSync(reportDir, { recursive: true })

	const logFile = path.join(reportDir, `${baseName}.log.txt`)

	/** @type {string[]} */
	let lines = []

	/** @type {number | null} */
	let lastProgress = null

	/** @type {string | null} */
	let lastPrefix = null

	/**
	 * @param {Date} [date]
	 */
	function formatDate(date = new Date()) {
		/**@param {number} n */
		const pad = (n) => String(n).padStart(2, '0')

		return (
			`${pad(date.getDate())}/` +
			`${pad(date.getMonth() + 1)}/` +
			`${date.getFullYear()} - ` +
			`${pad(date.getHours())}:` +
			`${pad(date.getMinutes())}:` +
			`${pad(date.getSeconds())}`
		)
	}

	/**
	 * @param {string} message
	 */
	function log(message) {
		lines.push(`[${formatDate()}] ${message}`)
		flush()
	}

	/**
	 * Nếu % trùng thì update dòng cuối (chỉ cập nhật time)
	 *
	 * @param {string} prefix
	 * @param {number} percent
	 */
	function logProgress(prefix, percent) {
		const time = `[${formatDate()}] ${prefix}: ${percent}%`

		if (percent === lastProgress && prefix === lastPrefix) {
			// update dòng cuối
			lines[lines.length - 1] = time
		} else {
			lines.push(time)
			lastProgress = percent
			lastPrefix = prefix
		}

		flush()
	}

	function flush() {
		fs.writeFileSync(logFile, lines.join('\n') + '\n', 'utf-8')
	}

	function close() {
		flush()
	}

	return { log, logProgress, close, logFile }
}
