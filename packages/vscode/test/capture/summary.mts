// Prints the Capture run's job summary in Markdown: the kept files and `vp run refresh-media`.
//
//   node test/capture/summary.mts <out-capture dir> >> "$GITHUB_STEP_SUMMARY"

import { jobSummary } from './refresh.mts'

const [outDir] = process.argv.slice(2)
if (outDir === undefined) throw new Error('usage: summary.mts <out-capture dir>')
process.stdout.write(jobSummary(outDir))
