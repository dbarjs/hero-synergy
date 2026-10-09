/**
 * The arithmetic of the capture run, apart from the window: the crop of a shot, the frame list of
 * the loop, the ffmpeg arguments for each format, and the contact sheet.
 */

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** The smallest rectangle holding every one of these. */
export function unionRect(rects: ReadonlyArray<Rect>): Rect {
  if (rects.length === 0) throw new Error('unionRect needs at least one rectangle')
  const left = Math.min(...rects.map((rect) => rect.x))
  const top = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

/**
 * The crop of a shot: the rectangle grown by `margin` on each side, kept inside the window, on whole
 * pixels, with an even width and height so the loop's H.264 encoder takes it.
 */
export function cropRect(rect: Rect, window: { width: number; height: number }, margin = 0): Rect {
  const left = Math.max(0, Math.floor(rect.x - margin))
  const top = Math.max(0, Math.floor(rect.y - margin))
  const right = Math.min(window.width, Math.ceil(rect.x + rect.width + margin))
  const bottom = Math.min(window.height, Math.ceil(rect.y + rect.height + margin))
  const even = (length: number) => length - (length % 2)
  return { x: left, y: top, width: even(right - left), height: even(bottom - top) }
}

export interface Frame {
  /** The frame's file name, relative to the list. */
  readonly file: string
  /** When it was taken, in milliseconds. */
  readonly at: number
}

/**
 * The ffmpeg concat list of the loop's frames: each shown until the next was taken, the last held
 * for `holdLast` ms so the loop rests on the end state before it starts again. The concat demuxer
 * reads the last file twice, or it drops the last duration.
 */
export function concatList(frames: ReadonlyArray<Frame>, holdLast: number): string {
  if (frames.length === 0) throw new Error('concatList needs at least one frame')
  const lines = ['ffconcat version 1.0']
  frames.forEach((frame, index) => {
    const next = frames[index + 1]
    const duration = next === undefined ? holdLast : next.at - frame.at
    lines.push(`file '${frame.file}'`, `duration ${(duration / 1000).toFixed(3)}`)
  })
  lines.push(`file '${frames[frames.length - 1]!.file}'`, '')
  return lines.join('\n')
}

/**
 * The frames from `from` ms on, timed from zero: the last frame taken at or before `from` opens
 * the loop, so the screen it showed at that moment is kept.
 */
export function trimFrames(frames: ReadonlyArray<Frame>, from: number): Frame[] {
  const first = Math.max(
    0,
    frames.findLastIndex((frame) => frame.at <= from),
  )
  const kept = frames.slice(first)
  const zero = kept[0]?.at ?? 0
  return kept.map((frame) => ({ ...frame, at: frame.at - zero }))
}

export interface LoopEncoding {
  /** The concat list of the frames. */
  readonly list: string
  /** Width of the output in pixels; the height follows the aspect ratio. */
  readonly width: number
  readonly fps: number
}

const scale = (width: number) => `scale=${width}:-2:flags=lanczos`

/** H.264 in MP4: the format a GitHub README plays when uploaded as a `user-attachments` video. */
export function mp4Args({ list, width, fps }: LoopEncoding, out: string): string[] {
  return [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-vf',
    `${scale(width)},fps=${fps}`,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    out,
  ]
}

/** An animated GIF on one palette for the whole loop: plays in the Marketplace, the Extensions view and GitHub. */
export function gifArgs({ list, width, fps }: LoopEncoding, out: string): string[] {
  return [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-filter_complex',
    `[0:v]${scale(width)},fps=${fps},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    '-loop',
    '0',
    out,
  ]
}

/** An animated WebP: the same loop as the GIF, in full color and a fraction of the size. */
export function webpArgs({ list, width, fps }: LoopEncoding, out: string): string[] {
  return [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    list,
    '-vf',
    `${scale(width)},fps=${fps}`,
    '-c:v',
    'libwebp_anim',
    '-lossless',
    '0',
    '-quality',
    '80',
    '-loop',
    '0',
    '-an',
    out,
  ]
}

export interface Shot {
  readonly file: string
  readonly caption: string
}

/** The contact sheet: a Markdown page with every shot and the loop, each under its caption. */
export function contactSheet(
  title: string,
  context: ReadonlyArray<string>,
  shots: ReadonlyArray<Shot>,
): string {
  const lines = [`# ${title}`, '', ...context.map((line) => `- ${line}`), '']
  for (const shot of shots) {
    lines.push(`## ${shot.caption}`, '', `\`${shot.file}\``, '')
    lines.push(
      shot.file.endsWith('.mp4')
        ? `[${shot.file}](${shot.file})`
        : `![${shot.caption}](${shot.file})`,
      '',
    )
  }
  return lines.join('\n')
}
