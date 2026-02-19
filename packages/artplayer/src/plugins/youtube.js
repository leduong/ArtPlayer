export default function youtube(art) {
  const { option, template } = art
  const { createElement } = art.constructor.utils
  const { $video, $player } = template

  let $container = null
  let youtubePlayer = null
  let syncTimer = null
  let ready = false

  function createContainer(id) {
    const container = createElement('div')
    container.id = `art-youtube-${id}`
    container.style.position = 'absolute'
    container.style.inset = '0'
    container.style.width = '100%'
    container.style.height = '100%'
    container.style.zIndex = '150'
    container.style.background = 'black'
    return container
  }

  function patchVideoProxy() {
    // Ẩn video thật, giữ lại để Artplayer “tưởng” đang điều khiển media element
    $video.style.display = 'none'

    // helper safe call
    const call = (fn, ...args) => {
      if (!youtubePlayer || !ready) return
      try {
        youtubePlayer[fn]?.(...args)
      } catch (_) {}
    }

    // play/pause mà Artplayer gọi
    $video.play = () => {
      call('playVideo')
      return Promise.resolve()
    }
    $video.pause = () => call('pauseVideo')

    // currentTime / duration
    Object.defineProperty($video, 'currentTime', {
      get() {
        if (!youtubePlayer || !ready) return 0
        const t = youtubePlayer.getCurrentTime?.()
        return Number.isFinite(t) ? t : 0
      },
      set(t) {
        if (!youtubePlayer || !ready) return
        youtubePlayer.seekTo?.(Number(t) || 0, true)
      },
      configurable: true,
    })

    Object.defineProperty($video, 'duration', {
      get() {
        if (!youtubePlayer || !ready) return 0
        const d = youtubePlayer.getDuration?.()
        return Number.isFinite(d) ? d : 0
      },
      configurable: true,
    })

    // volume: Artplayer dùng 0..1, YT dùng 0..100
    Object.defineProperty($video, 'volume', {
      get() {
        if (!youtubePlayer || !ready) return 1
        const v = youtubePlayer.getVolume?.()
        return Number.isFinite(v) ? Math.min(1, Math.max(0, v / 100)) : 1
      },
      set(v) {
        if (!youtubePlayer || !ready) return
        const vv = Math.round(Math.min(1, Math.max(0, Number(v))) * 100)
        youtubePlayer.setVolume?.(vv)
      },
      configurable: true,
    })

    Object.defineProperty($video, 'muted', {
      get() {
        if (!youtubePlayer || !ready) return false
        return !!youtubePlayer.isMuted?.()
      },
      set(m) {
        if (!youtubePlayer || !ready) return
        if (m) youtubePlayer.mute?.()
        else youtubePlayer.unMute?.()
      },
      configurable: true,
    })

    Object.defineProperty($video, 'playbackRate', {
      get() {
        if (!youtubePlayer || !ready) return 1
        const r = youtubePlayer.getPlaybackRate?.()
        return Number.isFinite(r) ? r : 1
      },
      set(r) {
        if (!youtubePlayer || !ready) return
        youtubePlayer.setPlaybackRate?.(Number(r) || 1)
      },
      configurable: true,
    })
  }

  function startSync() {
    stopSync()
    syncTimer = window.setInterval(() => {
      if (!youtubePlayer || !ready) return

      // bắn event để Artplayer UI tự update (progress/time)
      art.emit('video:timeupdate', { type: 'timeupdate' })
      art.emit('video:progress', { type: 'progress' })

      // nếu cần, bạn có thể emit thêm
      // art.emit('video:durationchange', { type: 'durationchange' });
    }, 250)
  }

  function stopSync() {
    if (syncTimer) window.clearInterval(syncTimer)
    syncTimer = null
  }

  function initPlayer() {
    const vid = parseVideoId(option.url)
    if (!vid) {
      art.notice.show = 'Invalid YouTube URL'
      return
    }

    // tạo container và mount
    $container = createContainer(vid)
    $player.appendChild($container)

    // IMPORTANT: render YT vào container (div), không phải $video
    youtubePlayer = new window.YT.Player($container, {
      videoId: vid,
      height: '100%',
      width: '100%',
      playerVars: {
        playsinline: 1,
        autoplay: option.autoplay ? 1 : 0,
        controls: 1,
        rel: 0,
        iv_load_policy: 3,
        modestbranding: 1,
      },
      events: {
        onReady: () => {
          ready = true
          patchVideoProxy()
          startSync()

          art.loading.show = false
          art.emit('video:loadedmetadata', { type: 'loadedmetadata' })
          art.emit('video:canplay', { type: 'canplay' })

          if (option.autoplay) youtubePlayer.playVideo()
        },
        onPlaybackRateChange: (e) => {
          art.emit('video:ratechange', { type: 'ratechange', data: e.data })
        },
        onStateChange: (e) => {
          const Y = window.YT
          switch (e.data) {
            case Y.PlayerState.PLAYING:
              art.emit('video:play', { type: 'play' })
              art.emit('video:playing', { type: 'playing' })
              break
            case Y.PlayerState.PAUSED:
              art.emit('video:pause', { type: 'pause' })
              break
            case Y.PlayerState.ENDED:
              art.emit('video:ended', { type: 'ended' })
              break
            case Y.PlayerState.BUFFERING:
              art.emit('video:waiting', { type: 'waiting' })
              break
            default:
              art.emit('video:statechange', { type: 'statechange', data: e.data })
          }
        },
      },
    })

    return youtubePlayer
  }

  function parseVideoId(input) {
    if (!input) return null
    if (/^[\w-]{11}$/.test(input)) return input

    try {
      const u = new URL(String(input).trim())
      const host = u.hostname.replace('www.', '')

      if (host === 'youtu.be') {
        const id = u.pathname.split('/')[1]
        return id && /^[\w-]{11}$/.test(id) ? id : null
      }

      if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
        const v = u.searchParams.get('v')
        if (v && /^[\w-]{11}$/.test(v)) return v

        // /shorts/<id>, /embed/<id>, /live/<id>
        const parts = u.pathname.split('/')
        const id = parts.find((p) => /^[\w-]{11}$/.test(p))
        return id || null
      }

      return null
    } catch {
      const m = String(input).match(/(?:youtu\.be\/|v=|\/(shorts|embed|live)\/)([\w-]{11})/)
      return m ? m[2] || m[1] : null
    }
  }

  function loadYouTubeAPI(cb) {
    if (window.YT && window.YT.Player) return cb()
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (!existing) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
    const orig = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = function () {
      if (typeof orig === 'function') orig()
      cb()
    }
  }

  function destroy() {
    stopSync()
    ready = false

    if (youtubePlayer?.destroy) youtubePlayer.destroy()
    youtubePlayer = null

    if ($container?.parentNode) $container.parentNode.removeChild($container)
    $container = null

    // show lại video nếu cần
    $video.style.display = ''
  }

  function start() {
    $video.play?.()
  }
  function stop() {
    if (youtubePlayer?.stopVideo && ready) youtubePlayer.stopVideo()
    else $video.pause?.()
  }
  function mute() {
    $video.muted = true
  }

  loadYouTubeAPI(initPlayer)
  return { name: 'youtube-plugin', destroy, start, stop, mute }
}
