// @ts-check

import fs from 'fs'
import path from 'path'

const targetDirs = process.argv.slice(2)
if (!targetDirs.length) process.exit(1)

/**
 * Supported extensions
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
 */
function cleanup(dir) {
	const files = fs.readdirSync(dir)

	for (const file of files) {
		const full = path.join(dir, file)
		const stat = fs.statSync(full)

		if (stat.isDirectory()) {
			if (file === 'report') {
				fs.rmSync(full, { recursive: true, force: true })
			} else {
				cleanup(full)
			}
			continue
		}

		if (MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase())) {
			const baseName = path.basename(file, path.extname(file))
			const vttDir = path.join(dir, 'vtt')
			const output1 = path.join(vttDir, `${baseName}.txt`)
			const output2 = path.join(vttDir, `${baseName}.raw.txt`)

			if (fs.existsSync(output1) && fs.existsSync(output2)) {
				fs.unlinkSync(full)
			}
		}
	}
}

for (const targetDir of targetDirs) {
	const resolved = path.isAbsolute(targetDir) ? targetDir : path.resolve(process.cwd(), targetDir)
	if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
		console.error(`Skipping invalid directory: ${resolved}`)
		continue
	}
	console.log(`Cleaning: ${resolved}`)
	cleanup(resolved)
}
