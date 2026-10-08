/**
 * How long ago an epoch-millisecond time was, as the Tree words it: `12s`, `3m`, `2h`, `4d`. Computed
 * when the Tree draws, so an age is as fresh as the last view model and the page runs no timer.
 */
export function ageSince(since: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - since) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}
