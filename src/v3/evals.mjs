/**
 * @typedef {import('puppeteer').Page} Page
 */

/**
 * @param {Page} page
 */
export async function triggerGenerate(page) {
	await page.waitForFunction(() => new URLSearchParams(location.search).get('v') === 'startSelectFile', {
		timeout: 30000,
	})

	await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 })

	await page.evaluate(async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

		const ctn =
			document.body.childNodes[22].firstChild.firstChild.firstChild.childNodes[1].childNodes[1].childNodes[1]

		const visibleChild = [...ctn.childNodes[0].childNodes].filter((node) => !node.classList?.contains('hidden'))[0]
		visibleChild.childNodes[4].childNodes[0].childNodes[1].click()
		await sleep(2000)

		const target = [...document.querySelectorAll('.el-scrollbar')[3].querySelectorAll('li')].find((node) =>
			node.textContent.includes('Vietnam'),
		)
		if (!target) throw new Error('Không tìm thấy option Vietnamese')
		;['mousedown', 'mouseup', 'click'].forEach((e) => target.dispatchEvent(new MouseEvent(e, { bubbles: true })))
		await sleep(300)

		ctn.childNodes[2].querySelector('button').click()
	})

	console.log('Generate clicked.')
}

/**
 * @param {Page} page
 * @param {string} taskId
 * @param {number} [offset=0] seconds to add to all timestamps
 */
export async function getResult(page, taskId, offset = 0) {
	const res = await page.evaluate(async (id) => {
		const r = await fetch(`https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/translations/${id}?source=web`)
		return r.json()
	}, taskId)

	const data = res?.data
	const origin = data?.origin_subtitles
	const translation = data?.translation_subtitles

	if (!origin || !translation) {
		console.error('Miss result:', origin, translation)
		throw new Error('Miss result!')
	}

	return {
		origin: toWebVTT(origin, offset),
		translation: toWebVTT(translation, offset),
	}

	/**
	 * @param {Array<{start: number, end: number, text: string}>} items
	 * @param {number} offset ms
	 */
	function toWebVTT(items, offset) {
		const offsetMs = Math.round(offset * 1000)
		return (
			'WEBVTT\n\n' +
			items
				.map(
					(item, i) =>
						`${i + 1}\n${msToWebVTT(item.start + offsetMs)} --> ${msToWebVTT(item.end + offsetMs)}\n${item.text.trim()}`,
				)
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
