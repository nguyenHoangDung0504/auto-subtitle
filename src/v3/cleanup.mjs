// @ts-check

import fs from 'fs'
import path from 'path'

const targetDirs = process.argv.slice(2)
if (!targetDirs.length) process.exit(1)

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

		// File/dir có thể đã bị xóa trong iteration trước
		if (!fs.existsSync(full)) continue

		const stat = fs.statSync(full)

		if (stat.isDirectory()) {
			if (file === 'report') {
				fs.rmSync(full, { recursive: true, force: true })
			} else {
				cleanup(full)
			}
			continue
		}

		if (!MEDIA_EXTENSIONS.has(path.extname(file).toLowerCase())) continue

		const baseName = path.basename(file, path.extname(file))
		const vttDir = path.join(dir, 'vtt')
		const outputTxt = path.join(vttDir, `${baseName}.txt`)
		const outputRaw = path.join(vttDir, `${baseName}.raw.txt`)

		if (!fs.existsSync(outputTxt) || !fs.existsSync(outputRaw)) continue

		// Nếu là file chunked, kiểm tra state.merged trước khi xóa
		const stateFile = path.join(dir, 'chunks', `${baseName}.state.json`)
		if (fs.existsSync(stateFile)) {
			try {
				const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'))
				if (!state.merged) continue // chưa merge xong, không xóa
			} catch {
				continue // state corrupt, không xóa
			}

			// Xóa thư mục chunks/baseName và state file
			const chunkDir = path.join(dir, 'chunks', baseName)
			if (fs.existsSync(chunkDir)) {
				fs.rmSync(chunkDir, { recursive: true, force: true })
			}
			fs.unlinkSync(stateFile)

			// Xóa thư mục chunks nếu rỗng
			const chunksDir = path.join(dir, 'chunks')
			if (fs.existsSync(chunksDir) && fs.readdirSync(chunksDir).length === 0) {
				fs.rmdirSync(chunksDir)
			}
		}

		fs.unlinkSync(full)
		console.log(`Deleted: ${full}`)
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
