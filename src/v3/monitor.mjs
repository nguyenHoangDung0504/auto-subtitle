// @ts-check

import fs from 'fs'
import path from 'path'

const monitorFile = path.join(process.cwd(), 'monitor.md')

/**
 * @typedef {{ file: string, logFile: string, status: string, part: number | null, totalParts: number | null }} TrackEntry
 */

/** @type {Map<string, TrackEntry>} */
const tracks = new Map()

function render() {
	/** @type {Map<string, TrackEntry[]>} */
	const byDir = new Map()

	for (const entry of tracks.values()) {
		const dir = path.dirname(entry.file)
		if (!byDir.has(dir)) byDir.set(dir, [])
		byDir.get(dir)?.push(entry)
	}

	const lines = ['# Autosub Monitor', `> Updated: ${new Date().toLocaleTimeString('vi-VN')}`, '']

	for (const [dir, entries] of byDir) {
		lines.push(`## ${dir}`)
		lines.push('')
		for (const entry of entries) {
			const baseName = path.basename(entry.file)
			const partInfo =
				entry.part !== null ? ` — part ${entry.part}${entry.totalParts ? `/${entry.totalParts}` : '+'}` : ''
			lines.push(`- ${entry.status} **${baseName}**${partInfo}`)

			const logUri = 'file:///' + entry.logFile.replace(/\\/g, '/').replace(/ /g, '%20')
			lines.push(`  - Log: ${logUri}`)
		}
		lines.push('')
	}

	fs.writeFileSync(monitorFile, lines.join('\n'), 'utf-8')
}

/**
 * @param {string} audioFile
 * @param {string} logFile
 */
export function monitorRegister(audioFile, logFile) {
	tracks.set(audioFile, {
		file: audioFile,
		logFile,
		status: '⏳',
		part: null,
		totalParts: null,
	})
	render()
}

/**
 * @param {string} audioFile
 * @param {{ status?: string, part?: number | null, totalParts?: number | null }} update
 */
export function monitorUpdate(audioFile, update) {
	const entry = tracks.get(audioFile)
	if (!entry) return
	if (update.status !== undefined) entry.status = update.status
	if (update.part !== undefined) entry.part = update.part
	if (update.totalParts !== undefined) entry.totalParts = update.totalParts
	render()
}
