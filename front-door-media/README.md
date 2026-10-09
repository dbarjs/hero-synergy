# Front-door media

Files cut from the 30-second trailer for [#118 Cut the trailer for the web](https://github.com/dbarjs/hero-synergy/issues/118). [#119 Prototype the two READMEs and the social card](https://github.com/dbarjs/hero-synergy/issues/119) chooses among them. `make.sh` makes every file again from `/tmp/hero-synergy-30s.mp4`.

| File             | Size        | Dimensions | From                     | For                                                    |
| ---------------- | ----------- | ---------- | ------------------------ | ------------------------------------------------------ |
| `poster.png`     | 794,287 B   | 1280 × 720 | title card, 9.2 s        | A link to the video; wherever it cannot play           |
| `poster.jpg`     | 34,719 B    | 1280 × 720 | title card, 9.2 s        | The same, lighter                                      |
| `card-seal.png`  | 809,175 B   | 1280 × 640 | the Seal lit gold, 8.2 s | Social preview candidate                               |
| `card-title.png` | 722,932 B   | 1280 × 640 | title card, 9.2 s        | Social preview candidate                               |
| `card-outro.png` | 775,677 B   | 1280 × 640 | outro, 29.9 s            | Social preview candidate, cut above the "+ CLI" footer |
| `banner-4x1.png` | 1,026,803 B | 1920 × 480 | title card, 9.2 s        | README banner at device scale 2, shown at 960 × 240    |
| `banner-4x1.jpg` | 54,870 B    | 1920 × 480 | title card, 9.2 s        | The same, lighter                                      |
| `banner-3x1.png` | 1,322,213 B | 1920 × 640 | title card, 9.2 s        | README banner at device scale 2, shown at 960 × 320    |
| `banner-3x1.jpg` | 62,305 B    | 1920 × 640 | title card, 9.2 s        | The same, lighter                                      |

The README video stays out of git: `make.sh` writes it to `/tmp/hero-synergy-readme.mp4`. It is about 9.4 MB (H.264 High, 1920 × 1080, 60 fps, 2.36 Mb/s, AAC-LC stereo at 128 kb/s, `faststart`), under the 10 MB a free plan allows an uploaded video, with 42.2 dB mean PSNR against the trailer. Two-pass x264 is multithreaded, so its size moves by a few kilobytes between runs.
