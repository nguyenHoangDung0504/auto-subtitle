/**
 * @typedef {import('puppeteer').Page} Page
 */

/**
 * @param {Page} page
 */
export async function triggerGenerate(page) {
	await page.waitForSelector('div[data-v-584aadf4].size-full.flex.flex-col', {
		timeout: 20000,
	})

	await page.evaluate(async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
		const scope = document.querySelector('div[data-v-584aadf4].size-full.flex.flex-col')

		scope.querySelector('.cursor-pointer[style*="--start"]').click()
		await sleep(500)

		const wrappers = scope.querySelectorAll('div[data-v-584aadf4].w-full.mt-\\[8px\\]')

		const wrapper = wrappers[1]
		const trigger = wrapper.querySelector('.flex.items-center.justify-between.w-full.h-full')

		;['mousedown', 'mouseup', 'click'].forEach((e) => trigger.dispatchEvent(new MouseEvent(e, { bubbles: true })))

		await sleep(800)

		const items = wrapper.querySelectorAll('ul > li')
		const target = [...items].find((li) => li.textContent.trim().toLowerCase() === 'vietnamese')

		;['mousedown', 'mouseup', 'click'].forEach((e) => target.dispatchEvent(new MouseEvent(e, { bubbles: true })))

		await sleep(300)

		scope.querySelector('button[data-v-584aadf4].gradient-button-auto-theme').click()
	})

	console.log('Generate clicked.')
}

/**
 * @param {Page} page
 */
export async function getResult(page) {
	const taskID = new URL(page.url()).searchParams.get('task-id')
	const res = await fetch(`https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/subtitles/recognition/v2/${taskID}`)
	const { data } = await res.json()

	const [{ subtitles: origin }, { subtitles: translation }] = data.subtitles
	if (!origin || !translation) {
		console.error('Miss result:', origin, translation)
		throw new Error('Miss result!')
	}

	return {
		origin: toWebVTT(origin),
		translation: toWebVTT(translation),
	}

	/**
	 * @param {{ start: number, end: number, text: string }} items
	 */
	function toWebVTT(items) {
		return (
			'WEBVTT\n\n' +
			items
				.map((item, i) => `${i + 1}\n${msToWebVTT(item.start)} --> ${msToWebVTT(item.end)}\n${item.text.trim()}`)
				.join('\n\n')
		)
	}

	/**
	 * @param {number} ms
	 */
	function msToWebVTT(ms) {
		const h = Math.floor(ms / 3600000)
		const m = Math.floor((ms % 3600000) / 60000)
		const s = Math.floor((ms % 60000) / 1000)
		const ms2 = ms % 1000

		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms2).padStart(3, '0')}`
	}
}
