// @ts-check

import path from 'path'
import fs from 'fs'

import { processAudio } from './process.mjs'

const targetDirs = process.argv.slice(2)
if (!targetDirs.length) {
	console.log(`
Usage:
  node generate.mjs <dir1> [dir2] [dir3] ...

Example:
  node generate.mjs ./media ./media2 /absolute/path/media3
`)
	process.exit(1)
}

const CONCURRENCY = 2

/**
 * Supported media extensions (audio + video).
 * @type {Set<string>}
 */
const MEDIA_EXTENSIONS = new Set([
	'.mp3',
	'.wav',
	'.m4a',
	'.flac',
	'.aac',
	'.ogg',
	'.mp4',
	'.mov',
	'.mkv',
	'.webm',
	'.avi',
])

/**
 * @param {string} dir
 * @returns {string[]}
 */
function getMediaFiles(dir) {
	const resolved = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir)
	if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
		console.error(`Skipping invalid directory: ${resolved}`)
		return []
	}
	console.log(`Scanning: ${resolved}`)
	return fs
		.readdirSync(resolved)
		.filter((f) => MEDIA_EXTENSIONS.has(path.extname(f).toLowerCase()))
		.map((f) => path.join(resolved, f))
}

const mediaFiles = targetDirs.flatMap(getMediaFiles)
if (!mediaFiles.length) {
	console.log('No supported media files found.')
	process.exit(0)
}
console.log(`Found ${mediaFiles.length} media files total.`)

const queue = [...mediaFiles]

await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1)))
console.log('All done.')
process.exit(0)

/**
 * @param {number} id
 */
async function worker(id) {
	while (queue.length) {
		const file = queue.shift()
		if (!file) break
		console.log(`Worker ${id} processing: ${file}`)
		await processAudio(file)
	}

	console.log(`Worker ${id} finished.`)
}
