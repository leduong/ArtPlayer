/* eslint-disable no-console */
function uniqBy(array, property) {
  const seen = new Map()
  return array.filter((item) => {
    const key = item[property]
    if (key === undefined) {
      return true
    }
    return !seen.has(key) && seen.set(key, 1)
  })
}

export default function hlsPlugin(art) {
  const { icons, option } = art
  const { $video } = art.template
  const { errorHandle } = art.constructor.utils

  function updateQuality(hls) {
    if (!hls.levels.length) return

    const config = option.quality || {}
    const auto = config.auto || 'Auto'
    const title = config.title || 'Quality'
    const getName = config.getName || ((level) => level.name || `${level.height}P`)
    const defaultLevel = hls.levels[hls.currentLevel]
    const defaultHtml = defaultLevel ? getName(defaultLevel) : auto

    const selector = uniqBy(
      hls.levels.map((item, index) => {
        return {
          html: getName(item, index),
          value: index,
          default: hls.currentLevel === index,
        }
      }),
      'html',
    ).sort((a, b) => b.value - a.value)

    selector.push({
      html: auto,
      value: -1,
      default: hls.currentLevel === -1,
    })

    const onSelect = (item) => {
      hls.currentLevel = item.value
      art.notice.show = `${title}: ${item.html}`
      if (config.control) art.controls.check(item)
      if (config.setting) art.setting.check(item)
      return item.html
    }

    if (config.control) {
      art.controls.update({
        name: 'hls-quality',
        position: 'right',
        html: defaultHtml,
        style: { padding: '0 10px' },
        selector,
        onSelect,
      })
    }

    if (config.setting) {
      art.setting.update({
        name: 'hls-quality',
        tooltip: defaultHtml,
        html: title,
        icon: icons.quality,
        width: 200,
        selector,
        onSelect,
      })
    }
  }

  function updateAudio(hls) {
    if (!hls.audioTracks.length) return

    const config = option.audio || {}
    const auto = config.auto || 'Auto'
    const title = config.title || 'Audio'
    const getName = config.getName || ((track) => track.name || track.lang || track.language)
    const defaultTrack = hls.audioTracks[hls.audioTrack]
    const defaultHtml = defaultTrack ? getName(defaultTrack) : auto

    const selector = uniqBy(
      hls.audioTracks.map((item, index) => {
        return {
          html: getName(item, index),
          value: item.id,
          default: hls.audioTrack === item.id,
        }
      }),
      'html',
    )

    const onSelect = (item) => {
      hls.audioTrack = item.value
      art.notice.show = `${title}: ${item.html}`
      if (config.control) art.controls.check(item)
      if (config.setting) art.setting.check(item)
      return item.html
    }

    if (config.control) {
      art.controls.update({
        name: 'hls-audio',
        position: 'right',
        html: defaultHtml,
        style: { padding: '0 10px' },
        selector,
        onSelect,
      })
    }

    if (config.setting) {
      art.setting.update({
        name: 'hls-audio',
        tooltip: defaultHtml,
        html: title,
        icon: icons.audio,
        width: 200,
        selector,
        onSelect,
      })
    }
  }

  function update() {
    errorHandle(art.hls?.media === $video, 'Cannot find instance of HLS from "art.hls"')
    updateQuality(art.hls)
    updateAudio(art.hls)
  }

  function loadHLS(cb) {
    const src = 'https://cdn.jsdelivr.net/npm/hls.js/dist/hls.min.js'

    // If Hls already available and supported, resolve immediately
    if (window.Hls && typeof window.Hls.isSupported === 'function' && window.Hls.isSupported()) {
      return cb()
    }

    // If script already injected, wait for its load/error events
    const existing = document.querySelector(`script[src="${src}"]`)
    if (!existing) {
      const script = document.createElement('script')
      script.src = src
      script.onload = cb
      script.onerror = () => errorHandle(false, 'Failed to load HLS.js library')
      document.head.appendChild(script)
      console.log('HLS.js library injected')
    }
  }

  async function initPlayer() {
    if (!option.url || !String(option.url).includes('.m3u8')) return
    console.log('Initializing HLS player for URL:', option.url)
    if (!window.Hls || !window.Hls.isSupported()) {
      console.error('HLS.js is not supported in this browser')
      art.notice.show = 'HLS playback is not supported in this browser'
      return
    }
    if (window.Hls && window.Hls.isSupported()) {
      if (art.hls) art.hls.destroy()
      const hls = new window.Hls()
      hls.loadSource(option.url)
      hls.attachMedia($video)
      art.hls = hls
      art.on('destroy', () => hls.destroy())
    } else if ($video.canPlayType('application/vnd.apple.mpegurl')) {
      $video.src = option.url
    } else {
      art.notice.show = 'Unsupported playback format: m3u8'
    }
  }

  loadHLS(initPlayer)
  art.on('ready', update)
  art.on('restart', update)

  return {
    name: 'hls-plugin',
    update,
  }
}
