// @ts-check

import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'

/**
 * @typedef {Object} Part
 * @property {number} index
 * @property {string} sourceAudio
 * @property {number} offset
 * @property {number} [cutAt]
 * @property {boolean} vttReady
 */

/**
 * @typedef {Object} ChunkState
 * @property {Part[]} parts
 * @property {boolean} merged
 */

/**
 * @param {string} audioFile
 * @returns {number} duration in seconds
 */
export function getAudioDuration(audioFile) {
	const result = execFileSync(
		'ffprobe',
		['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', audioFile],
		{ encoding: 'utf-8' },
	)
	return parseFloat(result.trim())
}

/**
 * @param {string} audioFile
 * @param {number} start seconds
 * @param {string} outFile
 */
export function cutAudio(audioFile, start, outFile) {
	fs.mkdirSync(path.dirname(outFile), { recursive: true })
	execFileSync('ffmpeg', ['-y', '-i', audioFile, '-ss', String(start), '-c', 'copy', outFile])
}

/**
 * @param {string} audioFile
 * @returns {{ stateFile: string, chunkDir: string, vttChunkDir: string }}
 */
export function getChunkPaths(audioFile) {
	const dir = path.dirname(audioFile)
	const baseName = path.basename(audioFile, path.extname(audioFile))
	const chunkDir = path.join(dir, 'chunks', baseName)
	const vttChunkDir = path.join(chunkDir, 'vtt')
	const stateFile = path.join(dir, 'chunks', `${baseName}.state.json`)
	return { stateFile, chunkDir, vttChunkDir }
}

/**
 * @param {string} stateFile
 * @returns {ChunkState | null}
 */
export function loadState(stateFile) {
	if (!fs.existsSync(stateFile)) return null
	try {
		return JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
	} catch {
		return null
	}
}

/**
 * @param {string} stateFile
 * @param {ChunkState} state
 */
export function saveState(stateFile, state) {
	fs.mkdirSync(path.dirname(stateFile), { recursive: true })
	fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf-8')
}

/**
 * Parse end timestamp của cue cuối cùng trong VTT string.
 * @param {string} vttContent
 * @returns {number} seconds
 */
export function getLastCueEnd(vttContent) {
	const matches = [...vttContent.matchAll(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/g)]
	if (!matches.length) throw new Error('No cues found in VTT')
	const last = matches[matches.length - 1][2]
	return webVTTToSeconds(last)
}

/**
 * @param {string} ts  HH:MM:SS,mmm
 * @returns {number} seconds
 */
function webVTTToSeconds(ts) {
	const [hms, ms] = ts.split(',')
	const [h, m, s] = hms.split(':').map(Number)
	return h * 3600 + m * 60 + s + Number(ms) / 1000
}

/**
 * Merge nhiều VTT content với offset, trả về VTT string đã merge.
 * @param {{ content: string, offset: number }[]} parts
 * @returns {string}
 */
export function mergeVTT(parts) {
	let cueIndex = 1
	const cues = []

	for (const { content, offset } of parts) {
		const lines = content.split('\n')
		let i = 0
		// Skip header
		while (i < lines.length && !lines[i].includes('-->')) i++

		while (i < lines.length) {
			if (!lines[i].includes('-->')) {
				i++
				continue
			}

			const timeLine = lines[i]
			const match = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/)
			if (!match) {
				i++
				continue
			}

			const start = webVTTToSeconds(match[1]) + offset
			const end = webVTTToSeconds(match[2]) + offset

			i++
			const textLines = []
			while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
				textLines.push(lines[i])
				i++
			}

			cues.push(`${cueIndex}\n${secondsToWebVTT(start)} --> ${secondsToWebVTT(end)}\n${textLines.join('\n')}`)
			cueIndex++
		}
	}

	return 'WEBVTT\n\n' + cues.join('\n\n')
}

/**
 * @param {number} seconds
 * @returns {string} HH:MM:SS,mmm
 */
function secondsToWebVTT(seconds) {
	const ms = Math.round((seconds % 1) * 1000)
	const s = Math.floor(seconds) % 60
	const m = Math.floor(seconds / 60) % 60
	const h = Math.floor(seconds / 3600)
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
