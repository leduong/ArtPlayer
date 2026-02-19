export function isYoutube(input) {
  if (!input) return false

  // Nếu user paste thẳng videoId 11 ký tự
  if (/^[\w-]{11}$/.test(input)) return true

  try {
    const url = new URL(String(input).trim())
    const host = url.hostname.replace(/^www\./, '').toLowerCase()

    const validHosts = ['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com']

    if (!validHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return false
    }

    // youtu.be/<id>
    if (host.includes('youtu.be')) {
      return /^[\w-]{11}$/.test(url.pathname.slice(1))
    }

    // youtube.com/watch?v=
    if (url.searchParams.get('v')) {
      return /^[\w-]{11}$/.test(url.searchParams.get('v'))
    }

    // /shorts/<id>  /embed/<id>  /live/<id>
    const parts = url.pathname.split('/')
    return parts.some((p) => /^[\w-]{11}$/.test(p))
  } catch {
    return false
  }
}
