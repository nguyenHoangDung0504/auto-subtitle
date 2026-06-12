/**
 * @typedef {import('puppeteer').Page} Page
 */

/**
 * @param {Page} page
 */
export async function triggerGenerate(page) {
	// Đợi URL đổi sang ?v=startSelectFile
	await page.waitForFunction(() => new URLSearchParams(location.search).get('v') === 'startSelectFile', {
		timeout: 30000,
	})

	// Đợi network idle để SPA render xong
	await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 })

	await page.evaluate(async () => {
		const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

		const ctn =
			document.body.childNodes[22].firstChild.firstChild.firstChild.childNodes[1].childNodes[1].childNodes[1]

		const visibleChild = [...ctn.childNodes[0].childNodes].filter((node) => !node.classList?.contains('hidden'))[0]
		visibleChild.childNodes[4].childNodes[0].childNodes[1].click()
		await sleep(800)

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
 */
export async function getResult(page, taskId) {
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
		origin: toWebVTT(origin),
		translation: toWebVTT(translation),
	}

	function toWebVTT(items) {
		return (
			'WEBVTT\n\n' +
			items
				.map(
					(item, i) => `${i + 1}\n${msToWebVTT(item.start)} --> ${msToWebVTT(item.end)}\n${item.text.trim()}`,
				)
				.join('\n\n')
		)
	}

	function msToWebVTT(ms) {
		const h = Math.floor(ms / 3600000)
		const m = Math.floor((ms % 3600000) / 60000)
		const s = Math.floor((ms % 60000) / 1000)
		const ms2 = ms % 1000
		return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms2).padStart(3, '0')}`
	}
}
