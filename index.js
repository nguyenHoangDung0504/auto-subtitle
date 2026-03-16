#!/usr/bin/env node
// @ts-check

import { execFileSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = process.argv.slice(2)

function showHelp() {
	console.log(`
Usage:
  node index.mjs -g [-t <dir1> [dir2] ...]   Generate subtitles
  node index.mjs -c [-t <dir1> [dir2] ...]   Cleanup media files
  node index.mjs -h                          Show this help

  If -t is omitted, defaults to current directory.

Examples:
  autosub -g                          # current directory
  autosub -g -t ./media ./media2
  autosub -c -t ./media /absolute/path/media2
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
const paths = pathIndex !== -1 ? args.slice(pathIndex + 1) : [process.cwd()]

const script = mode === '-g' ? 'generate.mjs' : 'cleanup.mjs'
const scriptPath = path.resolve(__dirname, './src', script)

execFileSync(process.execPath, [scriptPath, ...paths], { stdio: 'inherit' })
