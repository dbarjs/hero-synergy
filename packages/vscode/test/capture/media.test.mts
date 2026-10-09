import { describe, expect, it } from 'vite-plus/test'

import {
  concatList,
  contactSheet,
  cropRect,
  gifArgs,
  iconSquare,
  mp4Args,
  trimFrames,
  unionRect,
  webpArgs,
  webpEncoder,
} from './media.mts'

describe('unionRect', () => {
  it('holds every rectangle', () => {
    expect(
      unionRect([
        { x: 0, y: 0, width: 48, height: 900 },
        { x: 48, y: 35, width: 480, height: 840 },
        { x: 530, y: 560, width: 910, height: 315 },
      ]),
    ).toEqual({ x: 0, y: 0, width: 1440, height: 900 })
  })

  it('refuses an empty list', () => {
    expect(() => unionRect([])).toThrow('at least one')
  })
})

describe('cropRect', () => {
  const window = { width: 1440, height: 900 }

  it('rounds outwards to whole pixels and trims to an even size', () => {
    expect(cropRect({ x: 48.4, y: 35.5, width: 480.2, height: 300.3 }, window)).toEqual({
      x: 48,
      y: 35,
      width: 480,
      height: 300,
    })
  })

  it('grows by the margin and stays inside the window', () => {
    expect(cropRect({ x: 4, y: 850, width: 200, height: 48 }, window, 10)).toEqual({
      x: 0,
      y: 840,
      width: 214,
      height: 60,
    })
  })
})

describe('iconSquare', () => {
  it('is as wide as the bar and centred on the icon', () => {
    expect(
      iconSquare({ x: 6, y: 226, width: 32, height: 32 }, { x: 0, y: 35, width: 44, height: 840 }),
    ).toEqual({ x: 0, y: 220, width: 44, height: 44 })
  })

  it('crops to the 44 × 44 the listing shows, once on whole pixels', () => {
    const bar = { x: 0, y: 35, width: 44, height: 840 }
    const square = iconSquare({ x: 6, y: 226.5, width: 32, height: 32 }, bar)
    expect(cropRect(square, { width: 1440, height: 900 })).toEqual({
      x: 0,
      y: 220,
      width: 44,
      height: 44,
    })
  })
})

describe('concatList', () => {
  it('shows each frame until the next and holds the last, listed twice', () => {
    expect(
      concatList(
        [
          { file: 'frame-0000.png', at: 0 },
          { file: 'frame-0001.png', at: 66 },
          { file: 'frame-0002.png', at: 120 },
        ],
        1_500,
      ),
    ).toBe(
      [
        'ffconcat version 1.0',
        "file 'frame-0000.png'",
        'duration 0.066',
        "file 'frame-0001.png'",
        'duration 0.054',
        "file 'frame-0002.png'",
        'duration 1.500',
        "file 'frame-0002.png'",
        '',
      ].join('\n'),
    )
  })

  it('refuses no frames', () => {
    expect(() => concatList([], 1_000)).toThrow('at least one')
  })
})

describe('trimFrames', () => {
  const frames = [
    { file: 'a.png', at: 0 },
    { file: 'b.png', at: 60 },
    { file: 'c.png', at: 130 },
    { file: 'd.png', at: 190 },
  ]

  it('opens on the frame showing at the cut and times the rest from it', () => {
    expect(trimFrames(frames, 100)).toEqual([
      { file: 'b.png', at: 0 },
      { file: 'c.png', at: 70 },
      { file: 'd.png', at: 130 },
    ])
  })

  it('keeps every frame when the cut comes before the first', () => {
    expect(trimFrames(frames, -500)).toEqual(frames)
  })

  it('keeps no frame from none', () => {
    expect(trimFrames([], 100)).toEqual([])
  })
})

describe('the loop encodings', () => {
  const loop = { list: '/f/frames.ffconcat', width: 1200, fps: 12 }

  it('reads the concat list and writes the named file', () => {
    for (const args of [mp4Args(loop, 'a.mp4'), gifArgs(loop, 'a.gif'), webpArgs(loop, 'a.webp')]) {
      expect(args.slice(0, 7)).toEqual([
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        '/f/frames.ffconcat',
      ])
      expect(args.at(-1)).toMatch(/^a\.(mp4|gif|webp)$/)
    }
  })

  it('makes an MP4 every browser plays: H.264, 4:2:0, no audio, index first', () => {
    const args = mp4Args(loop, 'a.mp4').join(' ')
    expect(args).toContain('-c:v libx264')
    expect(args).toContain('-pix_fmt yuv420p')
    expect(args).toContain('-movflags +faststart')
    expect(args).toContain('-an')
    expect(args).toContain('scale=1200:-2:flags=lanczos,fps=12')
  })

  it('makes a GIF on one palette and a WebP, both looping forever', () => {
    const gif = gifArgs(loop, 'a.gif').join(' ')
    expect(gif).toContain('palettegen')
    expect(gif).toContain('paletteuse')
    expect(gif).toContain('-loop 0')
    const webp = webpArgs(loop, 'a.webp').join(' ')
    expect(webp).toContain('-c:v libwebp_anim')
    expect(webp).toContain('-loop 0')
  })
})

describe('webpEncoder', () => {
  const encoders = (...names: string[]) =>
    [
      'Encoders:',
      ' V..... = Video',
      ' ------',
      ...names.map((name) => ` V....D ${name}  ${name} encoder`),
    ].join('\n')

  it('prefers libwebp_anim, falls back to libwebp, and finds none in a build without WebP', () => {
    expect(webpEncoder(encoders('libx264', 'libwebp_anim', 'libwebp'))).toBe('libwebp_anim')
    expect(webpEncoder(encoders('libx264', 'libwebp'))).toBe('libwebp')
    expect(webpEncoder(encoders('libx264', 'gif', 'apng'))).toBeNull()
  })

  it('puts the chosen encoder in the arguments', () => {
    const args = webpArgs({ list: 'l', width: 10, fps: 1 }, 'a.webp', 'libwebp').join(' ')
    expect(args).toContain('-c:v libwebp ')
  })
})

describe('contactSheet', () => {
  it('shows each image under its caption and links the video', () => {
    expect(
      contactSheet(
        'Capture',
        ['Taken on linux.'],
        [
          { file: 'tree-dark.png', caption: 'The Tree' },
          { file: 'launch.mp4', caption: 'The loop' },
        ],
      ),
    ).toBe(
      [
        '# Capture',
        '',
        '- Taken on linux.',
        '',
        '## The Tree',
        '',
        '`tree-dark.png`',
        '',
        '![The Tree](tree-dark.png)',
        '',
        '## The loop',
        '',
        '`launch.mp4`',
        '',
        '[launch.mp4](launch.mp4)',
        '',
      ].join('\n'),
    )
  })
})
