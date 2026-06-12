Upload xong, để ý Network request:
https://reccloudhk.oss-cn-hongkong.aliyuncs.com/7a5/7a5178f7-e7c8-4871-b5f2-7d8af58a939c.m4a?uploadId=36E4888B55F44A82A4E160CB26204341

Response chứa uniqid:

```js
{
    "status": 200,
    "message": "success",
    "data": {
        "filename": "1.m4a",
        "resource_id": "551be9fc-428a-43e0-9c74-9d6737f99422",
        "size": 48231324,
        "type": 2,
        "cover_url": "",
        "duration": 1490000,
        "height": 0,
        "width": 0,
        "uniqid": "zvvrqdl",
        "user_id": 0,
        "task_id": "",
        "url": "https://reccloudhk.aoscdn.com/7a5/7a5178f7-e7c8-4871-b5f2-7d8af58a939c.m4a?auth_key=1777099571-187143-660056-5170156e4f55659320e26aaa27eddf15",
        "uri": "oss://oss-cn-hongkong.aliyuncs.com/reccloudhk/7a5/7a5178f7-e7c8-4871-b5f2-7d8af58a939c.m4a"
    }
}
```

Khi bấm nút gen nó track:

```js
fetch(
	'https://wx-user-behavior.cn-hongkong.log.aliyuncs.com/logstores/293/track?APIVersion=0.6.0&event=button_click',
	{
		headers: {
			accept: '*/*',
			'accept-language': 'en-US,en;q=0.9',
			'content-type': 'text/plain;charset=UTF-8',
			'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"Windows"',
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'no-cors',
			'sec-fetch-site': 'cross-site',
			'sec-fetch-storage-access': 'none',
		},
		referrer: 'https://reccloud.com/ai-subtitle?v=startSelectFile',
		body: '{"__logs__":[{"user_id":"no-login","browserType":"chrome","browserVersion":"146.0.0.0","platform":"windows","page_name":"ai-subtitle","apptype":"saas","role":"no-login","language":"en","browser":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36","host":"reccloud.com","clientWidth":"591","clientHeight":"731","event":"button_click","button_name":"start_translate_trans","trans_lang":"origin(jp)","filesize":"46","format":"m4a","time":"1490","position":"start_select_lang","remove_subtitle":"0"}]}',
		method: 'POST',
		mode: 'cors',
		credentials: 'omit',
	},
)
```

Sau đó:

Request: https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/subtitles/equity?app_lang=en&source=web&device_id=8lazmgNIT4_LCvhORXdr_

Response như sau, có thể là cách nó hiện UI?:

```json
{
	"status": 200,
	"message": "success",
	"data": {
		"equity": {
			"limit": 1,
			"used": 1,
			"price": 1,
			"limit_duration": 0,
			"limit_duration_anonymous": 0,
			"speaker_identification_limit_duration": 7200
		},
		"prices": {
			"subtitle_recognition": 1,
			"subtitle_translation": 2,
			"subtitle_elimination": 4,
			"subtitle_elimination_advanced": 20,
			"subtitle_translation_external": 2
		}
	}
}
```

Sau đó:

```js
fetch('https://gw.aoscdn.com/app/reccloud/v2/open/ai/av/subtitles/recognition/v2', {
	headers: {
		accept: '*/*',
		'accept-language': 'en-US,en;q=0.9',
		'content-type': 'text/plain;charset=UTF-8',
		priority: 'u=1, i',
		'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"',
		'sec-ch-ua-mobile': '?0',
		'sec-ch-ua-platform': '"Windows"',
		'sec-fetch-dest': 'empty',
		'sec-fetch-mode': 'cors',
		'sec-fetch-site': 'cross-site',
	},
	referrer: 'https://reccloud.com/ai-subtitle?v=startSelectFile',
	body: '{"language":"origin","uniqid":"zvvrqdl","truncated_at":0,"return_type":"0","type":"4","content_type":"0","device_id":"8lazmgNIT4_LCvhORXdr_","source_language":"jp","subtitle_elimination":0,"subtitle_box":null,"source":"web","app_lang":"en"}',
	method: 'POST',
	mode: 'cors',
	credentials: 'omit',
})
```
