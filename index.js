// @ts-check

import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)

function showHelp() {
	console.log(`
Usage:
  node index.mjs -g -path <dir1> [dir2] ...   Generate subtitles
  node index.mjs -c -path <dir1> [dir2] ...   Cleanup media files
  node index.mjs -h                           Show this help

Examples:
  node index.mjs -g -path ./media ./media2 # Relative path
  node index.mjs -c -path ./media /absolute/path/media2 # Absolute path
`)
}

if (!args.length || args.includes('-h')) {
	showHelp()
	process.exit(0)
}

const mode = args[0]
if (mode !== '-g' && mode !== '-c') {
	console.error(`Unknown option: ${mode}`)
	showHelp()
	process.exit(1)
}

const pathIndex = args.indexOf('-t')
if (pathIndex === -1 || pathIndex === args.length - 1) {
	console.error('Missing -t argument (target).')
	showHelp()
	process.exit(1)
}

const paths = args.slice(pathIndex + 1)

const script = mode === '-g' ? 'generate.mjs' : 'cleanup.mjs'
const scriptPath = path.resolve(__dirname, './src', script)

execFileSync(process.execPath, [scriptPath, ...paths], { stdio: 'inherit' })
