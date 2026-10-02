// lag between Claude Code registering an async hook (debug log) and the status event being written
import { readFileSync, readdirSync } from 'node:fs'
const lags = []; let swapped = 0, total = 0, minGap = Infinity
for (const f of readdirSync('out').filter((f) => f.endsWith('.events.jsonl'))) {
  const name = f.replace('.events.jsonl', '')
  const events = readFileSync(`out/${f}`, 'utf8').trim().split('\n').map((l) => JSON.parse(l))
  const regs = [...readFileSync(`out/${name}.debug.log`, 'utf8').matchAll(/^(\S+) \[DEBUG\] Hooks: Registering async hook \S+ \((\w+)/gm)]
    .map((m) => ({ at: Date.parse(m[1]), hook: m[2] }))
  // file order vs fire order
  events.forEach((e, i) => { total++; if (i && e.at < events[i - 1].at) swapped++ })
  regs.forEach((r, i) => { if (i) minGap = Math.min(minGap, r.at - regs[i - 1].at) })
  const sameOrder = regs.length === events.length && regs.every((r, i) => r.hook === events[i].hook)
  if (sameOrder) regs.forEach((r, i) => lags.push(events[i].at - r.at))
  console.log(name.padEnd(18), `fired ${regs.length}`, `written ${events.length}`, sameOrder ? 'same order' : 'ORDER OR COUNT DIFFERS')
}
lags.sort((a, b) => a - b)
console.log(`events ${total}, lines out of time order ${swapped}`)
console.log(`lag fire→write ms: min ${lags[0]} median ${lags[lags.length >> 1]} p95 ${lags[Math.floor(lags.length * 0.95)]} max ${lags.at(-1)} (n=${lags.length})`)
console.log(`smallest gap between two fired status hooks: ${minGap} ms`)
