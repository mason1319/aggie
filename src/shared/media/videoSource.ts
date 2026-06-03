const LOCAL_HOSTS = /^(localhost|127\.0\.0\.1|::1)$/i

function isLocalHost() {
  if (typeof window === 'undefined' || !window.location) {
    return false
  }
  return LOCAL_HOSTS.test(window.location.hostname)
}

function dedupe(items: string[]) {
  return items.filter((item, index, arr) => Boolean(item) && arr.indexOf(item) === index)
}

export function resolvePlayableVideoSources(rawSource: string): string[] {
  const source = rawSource.trim()
  if (!source) {
    return []
  }

  const candidates: string[] = []
  const sourceList: string[] = [source]

  const addCandidate = (candidate: string | undefined | null) => {
    const next = candidate?.trim()
    if (next && !candidates.includes(next)) {
      candidates.push(next)
    }
  }

  if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('data:')) {
    return dedupe(sourceList)
  }

  if (source.startsWith('/media/videos/') || source.startsWith('/media/')) {
    if (!isLocalHost()) {
      addCandidate(`/api/media-download?key=${encodeURIComponent(source.replace(/^\//, ''))}`)
      addCandidate(source)
      return dedupe([...candidates, ...sourceList])
    }
    addCandidate(source)
    addCandidate(`/api/media-download?key=${encodeURIComponent(source.replace(/^\//, ''))}`)
    return dedupe([...candidates, ...sourceList])
  }

  if (source.startsWith('/api/media-download?')) {
    addCandidate(source)
    const queryStart = source.indexOf('?')
    if (queryStart >= 0) {
      const params = new URLSearchParams(source.slice(queryStart + 1))
      const key = params.get('key')
      if (key) {
        addCandidate(`/${key}`)
      }
    }
    return dedupe(candidates)
  }

  return [source]
}

export function resolveVideoMetaSource(videoSrc: string, catalogSourceCandidates: string[]): string | null {
  if (!videoSrc) {
    return null
  }
  const raw = videoSrc.trim()
  if (!raw) {
    return null
  }
  const candidates = resolvePlayableVideoSources(raw)
  const playableSrc = candidates[0]
  if (!playableSrc) {
    return null
  }
  return catalogSourceCandidates.includes(raw) ? raw : playableSrc
}

export function resolvePlayableVideoSource(rawSource: string): string | null {
  return resolvePlayableVideoSources(rawSource)[0] ?? null
}
