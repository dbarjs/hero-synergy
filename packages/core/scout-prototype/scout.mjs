#!/usr/bin/env node
// PROTOTYPE — throwaway. Answers the ticket "Does the scout's interpret step earn its place?"
// (https://github.com/dbarjs/hero-synergy/issues/16). No dependencies: node >= 22, `gh`, `claude`.
//
//   node scout.mjs collect [owner/repo] > bundle.json     collect with code (one GraphQL query)
//   node scout.mjs parse <bundle>                          code-only reading of every map and ticket
//   node scout.mjs interpret <bundle> [--no-cache] [--concurrency N] [--whole]
//                                                          Haiku reading of every map and ticket, per item, cached by content hash
//   node scout.mjs compare <bundle> [--no-cache] [--concurrency N]
//                                                          both readings, reconciled, field by field; frontier under each
//   node scout.mjs frontier <bundle>                       code-only snapshot's frontier
//
// <bundle> is the JSON `gh api graphql` returns, or a .mjs fixture whose default export has the same shape.

import { execFileSync, execFile } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const LABELS = ['wayfinder:map', 'wayfinder:research', 'wayfinder:prototype', 'wayfinder:grilling', 'wayfinder:task', 'wayfinder:claimed'];
const TYPES = ['research', 'prototype', 'grilling', 'task'];

// ---------------------------------------------------------------- bundle

async function loadBundle(path) {
  const abs = resolve(path);
  let raw;
  if (abs.endsWith('.mjs')) raw = (await import(pathToFileURL(abs).href)).default;
  else raw = JSON.parse(readFileSync(abs, 'utf8'));
  const pages = Array.isArray(raw) ? raw : [raw];
  const items = pages.flatMap((p) => p.data.repository.issues.nodes);
  const repoLabels = pages[0].data.repository.labels.nodes.map((l) => l.name).filter((n) => n.startsWith('wayfinder:'));
  return { items, repoLabels, rateLimit: pages.map((p) => p.data.rateLimit) };
}

function collect(repo) {
  const [owner, name] = (repo ?? execFileSync('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).toString().trim()).split('/');
  const args = ['api', 'graphql', '-F', `query=@${join(here, 'scout.graphql')}`, '-f', `owner=${owner}`, '-f', `repo=${name}`];
  for (const l of LABELS) args.push('-f', `labels[]=${l}`);
  const t0 = performance.now();
  const out = execFileSync('gh', args, { maxBuffer: 64 * 1024 * 1024 }).toString();
  process.stderr.write(`collect: ${Math.round(performance.now() - t0)} ms, ${out.length} bytes\n`);
  return out;
}

// ---------------------------------------------------------------- code-only reading (parse)

const stripComments = (md) => md.replace(/<!--[\s\S]*?-->/g, '');
const normHeading = (h) => h.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
const SECTION = { destination: 'destination', notes: 'notes', 'decisions so far': 'decisions', 'not yet specified': 'notYetSpecified', fog: 'notYetSpecified', 'out of scope': 'outOfScope', deferred: 'outOfScope' };

function sections(md) {
  const out = [{ heading: '', lines: [] }];
  for (const line of md.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) out.push({ heading: m[1], lines: [] });
    else out.at(-1).lines.push(line);
  }
  return out.map((s) => ({ heading: s.heading, key: SECTION[normHeading(s.heading)] ?? null, text: s.lines.join('\n').trim() }));
}

function bullets(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = /^\s*[-*]\s+(.*)$/.exec(line);
    if (m) out.push(m[1].trim());
    else if (out.length && line.trim()) out[out.length - 1] += ' ' + line.trim();
  }
  return out;
}

const LINK = /\[([^\]]+?)\]\((\S+?)\)/g;
const issueNumber = (href) => Number((/\/issues\/(\d+)/.exec(href) ?? /^#(\d+)$/.exec(href) ?? [])[1]) || null;
const firstSentence = (s, max = 160) => {
  const t = s.replace(/\s+/g, ' ').trim();
  const m = /^(.+?[.!?])(\s|$)/.exec(t);
  const out = m ? m[1] : t;
  return out.length > max ? out.slice(0, max - 1) + '…' : out;
};

function parseMap(item) {
  const warnings = [];
  const body = stripComments(item.body ?? '');
  const secs = sections(body);
  const has = (k) => secs.some((s) => s.key === k);
  const raw = (k) => secs.filter((s) => s.key === k).map((s) => s.text).join('\n\n').trim();
  const headings = secs.filter((s) => s.heading).map((s) => normHeading(s.heading));
  let bodyForm;
  if (headings.includes('not yet specified')) bodyForm = 'M5';
  else if (headings.includes('deferred')) bodyForm = 'M4';
  else if (headings.includes('fog') && headings.includes('destination')) bodyForm = 'M3';
  else if (headings.includes('fog')) bodyForm = 'M2';
  else if (secs.some((s) => s.key)) bodyForm = 'partial';
  else bodyForm = 'free-form';
  if (bodyForm !== 'M5') warnings.push(`map body is ${bodyForm}, not the current five-section form`);
  if (!has('destination')) warnings.push('no Destination section');

  const decisions = [];
  for (const b of bullets(raw('decisions'))) {
    const m = /^\[([^\]]+?)\]\((\S+?)\)\s*(?:—|–|:|-)\s*(.*)$/.exec(b);
    if (m) decisions.push({ title: m[1], url: m[2], number: issueNumber(m[2]), gist: m[3].trim() });
    else { decisions.push({ title: null, url: null, number: null, gist: b }); warnings.push(`decision line is not "[title](link) — gist": ${b.slice(0, 60)}`); }
  }
  const notYetSpecified = bullets(raw('notYetSpecified')).map((b) => ({ text: b, tickets: [...b.matchAll(LINK)].map((m) => issueNumber(m[2])).filter(Boolean) }));
  const outOfScope = bullets(raw('outOfScope')).map((b) => ({ text: b, tickets: [...b.matchAll(LINK)].map((m) => issueNumber(m[2])).filter(Boolean) }));
  const taskList = [...body.matchAll(/^\s*- \[( |x|X)\]\s+(?:#(\d+)|\S*?\/issues\/(\d+))/gm)].map((m) => Number(m[2] ?? m[3]));
  if (taskList.length) warnings.push('children listed as a task list in the map body (text fallback)');
  return { kind: 'map', bodyForm, destination: raw('destination') || null, notes: raw('notes') || null, decisions, notYetSpecified, outOfScope, taskList, warnings };
}

function parseTicket(item) {
  const warnings = [];
  const labels = item.labels.nodes.map((l) => l.name);
  const body = stripComments(item.body ?? '');
  const lines = body.split(/\r?\n/);
  const nonEmpty = lines.filter((l) => l.trim());
  const partOf = Number((/^Part of #(\d+)/i.exec(nonEmpty[0] ?? '') ?? [])[1]) || null;
  if (partOf) warnings.push('parent given as a "Part of #n" line (text fallback)');
  let textBlockedBy = [];
  for (const l of nonEmpty.slice(0, 12)) {
    const m = /^(?:Blocked by|blocked_by):\s*(.*)$/i.exec(l.trim());
    if (!m) continue;
    const value = m[1].replace(/[\[\]]/g, '').trim();
    const nums = [...value.matchAll(/#?(\d+)\b/g)].map((x) => Number(x[1]));
    if (value && !nums.length) warnings.push(`"Blocked by" holds slugs, not numbers: ${value}`);
    textBlockedBy = nums;
    if (nums.length) warnings.push('blockers given as a "Blocked by:" line (text fallback)');
  }
  const typeLabels = labels.filter((l) => TYPES.includes(l.replace('wayfinder:', '')) && l.startsWith('wayfinder:')).map((l) => l.replace('wayfinder:', ''));
  let type = typeLabels[0] ?? null;
  if (typeLabels.length > 1) warnings.push(`several type labels: ${typeLabels.join(', ')}`);
  if (!type) {
    const m = /^Type:\s*(\w+)/im.exec(body);
    if (m && TYPES.includes(m[1].toLowerCase())) { type = m[1].toLowerCase(); warnings.push('type given as a "Type:" line, not a label (single-file form)'); }
    else warnings.push('no wayfinder:<type> label');
  }
  const legacyClaim = labels.includes('wayfinder:claimed');
  if (legacyClaim) warnings.push('legacy "wayfinder:claimed" label');
  const secs = sections(body);
  const q = secs.find((s) => normHeading(s.heading) === 'question');
  let question;
  if (q) question = q.text;
  else {
    question = lines.filter((l) => !/^(Part of #|Blocked by:|blocked_by:|Type:|Status:)/i.test(l.trim())).join('\n').trim();
    warnings.push('no "## Question" heading');
  }
  const unknownLabels = labels.filter((l) => l.startsWith('wayfinder:') && !LABELS.includes(l));
  if (unknownLabels.length) warnings.push(`unknown wayfinder labels: ${unknownLabels.join(', ')}`);
  const last = item.comments.nodes.at(-1);
  const resolution = item.state === 'CLOSED' && last ? { author: last.author?.login ?? null, gist: firstSentence(last.body) } : null;
  if (item.state === 'CLOSED' && !last) warnings.push('closed with no comment to read as the answer');
  return { kind: 'ticket', type, partOf, textBlockedBy, legacyClaim, question, summary: firstSentence(question), resolution, warnings };
}

const isMap = (item) => item.labels.nodes.some((l) => l.name === 'wayfinder:map');
const parseItem = (item) => (isMap(item) ? parseMap(item) : parseTicket(item));

// ---------------------------------------------------------------- model reading (interpret)

const CONVENTIONS = `You read wayfinder maps and tickets from an issue tracker and extract their content into a fixed JSON shape. Wayfinder is a planning skill: a MAP issue (label wayfinder:map) indexes one effort's decisions; TICKET issues are its children, each one question, typed by a wayfinder:<type> label (research, prototype, grilling, task).

Current conventions (2026): a map body has the H2 sections Destination, Notes, Decisions so far, Not yet specified, Out of scope. Each "Decisions so far" line is "- [ticket title](link) — gist" (older: "- [title](link): gist"). "Out of scope" lines name work ruled out, usually linking a closed ticket. A ticket body is a "## Question" section; the answer is the closing comment, never the body. Children are native sub-issues; blockers are native dependencies; the claim is the assignee.

Older forms you may meet: a map body with Notes / Decisions so far / Fog (Fog = Not yet specified) or with a Deferred section (= Out of scope); children listed as a task list in the map body plus a "Part of #<map>" first line on the ticket; blockers as a "Blocked by: #n, #n" line at the top of the ticket; a "wayfinder:claimed" label instead of an assignee; a "Type: <type>" line instead of a label; tickets without a "## Question" heading; free-form markdown written by hand.

Rules: extract only what the text says, never invent. Do not report facts the tracker API already holds (state, native parent, native blockers, assignees). Leave a field null or empty when the text has nothing for it. Put every departure from the current conventions, and anything a human should look at, in "warnings", one short line each. Gists are one short sentence.`;

const MAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    bodyForm: { type: 'string', enum: ['M2', 'M3', 'M4', 'M5', 'partial', 'free-form'], description: 'M5 = Destination/Notes/Decisions so far/Not yet specified/Out of scope; M4 has Deferred; M3 has Destination and Fog; M2 has Fog and no Destination; partial = some of the sections; free-form = none' },
    destination: { type: ['string', 'null'] },
    notes: { type: ['string', 'null'] },
    decisions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: ['string', 'null'] }, url: { type: ['string', 'null'] }, number: { type: ['integer', 'null'] }, gist: { type: 'string' } }, required: ['title', 'url', 'number', 'gist'] } },
    notYetSpecified: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, tickets: { type: 'array', items: { type: 'integer' } } }, required: ['text', 'tickets'] } },
    outOfScope: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { text: { type: 'string' }, tickets: { type: 'array', items: { type: 'integer' } } }, required: ['text', 'tickets'] } },
    taskList: { type: 'array', items: { type: 'integer' }, description: 'issue numbers of a task list in the body, in order; empty when there is none' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['bodyForm', 'destination', 'notes', 'decisions', 'notYetSpecified', 'outOfScope', 'taskList', 'warnings'],
};

const TICKET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    type: { type: ['string', 'null'], enum: [...TYPES, null] },
    partOf: { type: ['integer', 'null'], description: 'map number from a "Part of #n" line, else null' },
    textBlockedBy: { type: 'array', items: { type: 'integer' }, description: 'issue numbers from a "Blocked by:" line, else empty' },
    legacyClaim: { type: 'boolean', description: 'true only when the labels include wayfinder:claimed' },
    question: { type: 'string', description: 'the question text, verbatim' },
    summary: { type: 'string', description: 'the question in one short sentence' },
    resolution: { type: ['object', 'null'], additionalProperties: false, properties: { author: { type: ['string', 'null'] }, gist: { type: 'string' } }, required: ['author', 'gist'], description: 'for a closed ticket, the answer read from the comments; null when open or when no comment answers it' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'partOf', 'textBlockedBy', 'legacyClaim', 'question', 'summary', 'resolution', 'warnings'],
};

// Lean schemas: only what code cannot read itself (gists, free-form content, judgement), no verbatim echo.
const MAP_SCHEMA_LEAN = {
  type: 'object', additionalProperties: false,
  properties: {
    bodyForm: MAP_SCHEMA.properties.bodyForm,
    destinationGist: { type: ['string', 'null'], description: 'the destination in one sentence, or null' },
    decisions: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { number: { type: ['integer', 'null'] }, gist: { type: 'string' } }, required: ['number', 'gist'] } },
    notYetSpecifiedCount: { type: 'integer' },
    outOfScopeTickets: { type: 'array', items: { type: 'integer' }, description: 'issue numbers linked from Out of scope (or the equivalent prose)' },
    taskList: MAP_SCHEMA.properties.taskList,
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['bodyForm', 'destinationGist', 'decisions', 'notYetSpecifiedCount', 'outOfScopeTickets', 'taskList', 'warnings'],
};
const TICKET_SCHEMA_LEAN = {
  type: 'object', additionalProperties: false,
  properties: {
    type: TICKET_SCHEMA.properties.type, partOf: TICKET_SCHEMA.properties.partOf, textBlockedBy: TICKET_SCHEMA.properties.textBlockedBy, legacyClaim: TICKET_SCHEMA.properties.legacyClaim,
    summary: TICKET_SCHEMA.properties.summary,
    resolutionGist: { type: ['string', 'null'], description: 'for a closed ticket, the answer in one sentence read from the comments; null when open or unanswered' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['type', 'partOf', 'textBlockedBy', 'legacyClaim', 'summary', 'resolutionGist', 'warnings'],
};
function fromLean(v, map) {
  if (map) return { bodyForm: v.bodyForm, destination: v.destinationGist, notes: null, decisions: v.decisions.map((d) => ({ title: null, url: null, number: d.number, gist: d.gist })), notYetSpecified: Array.from({ length: v.notYetSpecifiedCount }, () => ({ text: '', tickets: [] })), outOfScope: v.outOfScopeTickets.map((n) => ({ text: '', tickets: [n] })), taskList: v.taskList, warnings: v.warnings };
  return { type: v.type, partOf: v.partOf, textBlockedBy: v.textBlockedBy, legacyClaim: v.legacyClaim, question: null, summary: v.summary, resolution: v.resolutionGist == null ? null : { author: null, gist: v.resolutionGist }, warnings: v.warnings };
}

const contentHash = (item) => createHash('sha256').update(JSON.stringify({ t: item.title, s: item.state, b: item.body, l: item.labels.nodes, a: item.assignees.nodes, c: item.comments.nodes })).digest('hex').slice(0, 16);

function claudeJson({ prompt, stdin, schema, system }) {
  return new Promise((res, rej) => {
    const args = ['-p', prompt, '--model', 'haiku', '--safe-mode', '--permission-mode', 'dontAsk', '--no-session-persistence', '--tools', '', '--output-format', 'json', '--json-schema', JSON.stringify(schema)];
    if (system) args.push('--system-prompt', system);
    if (process.env.SCOUT_EFFORT) args.push('--effort', process.env.SCOUT_EFFORT);
    const t0 = performance.now();
    const child = execFile('claude', args, { maxBuffer: 64 * 1024 * 1024, env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' } }, (err, stdout, stderr) => {
      const wall = Math.round(performance.now() - t0);
      if (err && !stdout) return rej(new Error(`claude failed: ${err.message}\n${stderr}`));
      let out;
      try { out = JSON.parse(stdout); } catch { return rej(new Error(`claude returned non-JSON: ${stdout.slice(0, 300)}`)); }
      if (out.is_error || !out.structured_output) return rej(new Error(`claude error: ${out.result ?? JSON.stringify(out).slice(0, 300)}`));
      const u = out.usage ?? {};
      const thinking = u.output_tokens_details?.thinking_tokens ?? 0;
      res({ value: out.structured_output, metrics: { wall, api: out.duration_api_ms, cost: out.total_cost_usd, input: u.input_tokens, cacheWrite: u.cache_creation_input_tokens, cacheRead: u.cache_read_input_tokens, output: u.output_tokens, thinking, turns: out.num_turns } });
    });
    child.stdin.end(stdin);
  });
}

function itemForModel(item) {
  return { number: item.number, title: item.title, state: item.state, labels: item.labels.nodes.map((l) => l.name), assignees: item.assignees.nodes.map((a) => a.login), body: item.body, comments: item.comments.nodes.map((c) => ({ author: c.author?.login ?? null, createdAt: c.createdAt, body: c.body })) };
}

async function interpretItem(item, opts) {
  const { cacheDir, useCache } = opts;
  const key = contentHash(item);
  const file = cacheDir && join(cacheDir, `${item.number}-${key}.json`);
  if (useCache && file && existsSync(file)) return { value: JSON.parse(readFileSync(file, 'utf8')), cached: true, key };
  const map = isMap(item);
  const r = await claudeJson({
    system: CONVENTIONS,
    prompt: map ? `Read this wayfinder MAP issue and fill the schema from its body.` : `Read this wayfinder TICKET issue and fill the schema from its body, labels and comments.`,
    stdin: JSON.stringify(itemForModel(item), null, 1),
    schema: opts.lean ? (map ? MAP_SCHEMA_LEAN : TICKET_SCHEMA_LEAN) : map ? MAP_SCHEMA : TICKET_SCHEMA,
  });
  const value = { kind: map ? 'map' : 'ticket', ...(opts.lean ? fromLean(r.value, map) : r.value) };
  if (file) { mkdirSync(cacheDir, { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2)); }
  return { value, cached: false, key, metrics: r.metrics };
}

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

async function interpretAll(bundle, opts) {
  const t0 = performance.now();
  const results = await pool(bundle.items, opts.concurrency, (item) => interpretItem(item, opts));
  const wall = Math.round(performance.now() - t0);
  const calls = results.filter((r) => !r.cached);
  const sum = (k) => calls.reduce((a, r) => a + (r.metrics[k] ?? 0), 0);
  const metrics = { items: bundle.items.length, calls: calls.length, cacheHits: results.length - calls.length, wallMs: wall, perCallMs: calls.length ? Math.round(sum('wall') / calls.length) : 0, costUsd: +sum('cost').toFixed(4), inputTokens: sum('input'), cacheWriteTokens: sum('cacheWrite'), cacheReadTokens: sum('cacheRead'), outputTokens: sum('output'), thinkingTokens: sum('thinking'), perItem: results.map((r, i) => ({ number: bundle.items[i].number, cached: r.cached, ...(r.metrics ?? {}) })) };
  return { readings: Object.fromEntries(bundle.items.map((it, i) => [it.number, results[i].value])), metrics };
}

async function interpretWhole(bundle) {
  const schema = { type: 'object', additionalProperties: false, properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { number: { type: 'integer' }, map: { ...MAP_SCHEMA, type: ['object', 'null'] }, ticket: { ...TICKET_SCHEMA, type: ['object', 'null'] } }, required: ['number', 'map', 'ticket'] } } }, required: ['items'] };
  const r = await claudeJson({ system: CONVENTIONS, prompt: 'Read every wayfinder issue in this bundle. For each, fill "map" (for a wayfinder:map issue) or "ticket" (otherwise) and leave the other null.', stdin: JSON.stringify(bundle.items.map(itemForModel), null, 1), schema });
  return r;
}

// ---------------------------------------------------------------- reconcile (code): API facts win, readings fill the gaps

function reconcile(bundle, readings) {
  const byNumber = new Map(bundle.items.map((it) => [it.number, it]));
  const maps = bundle.items.filter(isMap);
  const tickets = bundle.items.filter((it) => !isMap(it));
  const warnings = [];
  const unknownRepoLabels = bundle.repoLabels.filter((l) => !LABELS.includes(l));
  if (unknownRepoLabels.length) warnings.push(`repo has wayfinder labels the scout did not ask for: ${unknownRepoLabels.join(', ')}`);

  const mapOf = new Map();
  for (const m of maps) {
    const reading = readings[m.number];
    const native = m.subIssues.nodes.map((s) => s.number);
    const children = native.length ? native : reading.taskList;
    for (const c of children) mapOf.set(c, { map: m.number, via: native.length ? 'native' : 'task-list' });
  }
  for (const t of tickets) {
    const reading = readings[t.number];
    if (t.parent?.number) mapOf.set(t.number, { map: t.parent.number, via: 'native' });
    else if (!mapOf.has(t.number) && reading.partOf) mapOf.set(t.number, { map: reading.partOf, via: 'part-of' });
  }

  const snapTickets = tickets.map((t) => {
    const r = readings[t.number];
    const w = [...r.warnings];
    const parent = mapOf.get(t.number) ?? null;
    if (!parent) w.push('no map found (no native parent, no task list entry, no "Part of" line)');
    const nativeBlockers = t.blockedBy.nodes.map((b) => ({ number: b.number, state: b.state, via: 'native' }));
    const textBlockers = r.textBlockedBy.filter((n) => !nativeBlockers.some((b) => b.number === n)).map((n) => ({ number: n, state: byNumber.get(n)?.state ?? 'UNKNOWN', via: 'text' }));
    const blockedBy = [...nativeBlockers, ...textBlockers];
    const openBlockers = blockedBy.filter((b) => b.state !== 'CLOSED').map((b) => b.number);
    const assignees = t.assignees.nodes.map((a) => a.login);
    const claimed = t.state === 'OPEN' && (assignees.length > 0 || r.legacyClaim);
    let resolution = { kind: t.state === 'OPEN' ? 'none' : 'unrecorded', gist: r.resolution?.gist ?? null };
    if (t.state === 'CLOSED' && parent) {
      const m = readings[parent.map];
      if (m.decisions.some((d) => d.number === t.number)) resolution.kind = 'answered';
      else if (m.outOfScope.some((o) => o.tickets.includes(t.number))) resolution.kind = 'out-of-scope';
      else w.push('closed, but the map neither lists it under Decisions so far nor under Out of scope');
    }
    return { number: t.number, title: t.title, url: t.url, state: t.state, type: r.type, map: parent?.map ?? null, mapVia: parent?.via ?? null, question: r.question, summary: r.summary, assignees, claimed, blockedBy, openBlockers, resolution, warnings: w };
  });

  const snapMaps = maps.map((m) => {
    const r = readings[m.number];
    const native = m.subIssues.nodes.map((s) => s.number);
    const order = native.length ? native : r.taskList;
    const mine = snapTickets.filter((t) => t.map === m.number);
    const ordered = [...mine].sort((a, b) => { const ia = order.indexOf(a.number), ib = order.indexOf(b.number); return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib) || a.number - b.number; });
    const frontier = ordered.filter((t) => t.state === 'OPEN' && !t.claimed && t.openBlockers.length === 0).map((t) => t.number);
    const w = [...r.warnings];
    for (const d of r.decisions) if (d.number && byNumber.get(d.number)?.state === 'OPEN') w.push(`Decisions so far links an open ticket #${d.number}`);
    return { number: m.number, title: m.title, url: m.url, state: m.state, bodyForm: r.bodyForm, destination: r.destination, notes: r.notes, decisions: r.decisions, notYetSpecified: r.notYetSpecified, outOfScope: r.outOfScope, tickets: ordered.map((t) => t.number), frontier, warnings: w };
  });
  return { maps: snapMaps, tickets: snapTickets, warnings };
}

// ---------------------------------------------------------------- compare

const norm = (v) => JSON.stringify(v, (k, x) => (typeof x === 'string' ? x.replace(/\s+/g, ' ').trim() : x));
const short = (v, n = 70) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s == null ? 'null' : s.length > n ? s.slice(0, n - 1) + '…' : s; };

function compareReadings(bundle, code, model, lean = false) {
  const skip = lean ? new Set(['destination', 'notes', 'notYetSpecified', 'question']) : new Set();
  const rows = [];
  for (const it of bundle.items) {
    const a = code[it.number], b = model[it.number];
    const fields = isMap(it) ? ['bodyForm', 'destination', 'notes', 'decisions', 'notYetSpecified', 'outOfScope', 'taskList'] : ['type', 'partOf', 'textBlockedBy', 'legacyClaim', 'question', 'resolution'];
    for (const f of fields) {
      if (skip.has(f)) continue;
      let same = norm(a[f]) === norm(b[f]);
      if (!same && f === 'decisions') same = norm(a[f].map((d) => [d.number, d.gist])) === norm(b[f].map((d) => [d.number, d.gist]));
      if (!same && (f === 'notYetSpecified' || f === 'outOfScope')) same = norm(a[f].map((x) => x.tickets)) === norm(b[f].map((x) => x.tickets)) && a[f].length === b[f].length;
      if (!same && f === 'resolution') same = (a[f] == null) === (b[f] == null);
      rows.push({ item: `#${it.number}`, field: f, same, code: short(a[f]), model: short(b[f]) });
    }
    rows.push({ item: `#${it.number}`, field: 'warnings', same: null, code: a.warnings.length, model: b.warnings.length });
  }
  return rows;
}

function printTable(rows, cols) {
  const widths = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  const line = (r) => cols.map((c, i) => String(r[c] ?? '').padEnd(widths[i])).join('  ');
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(name); if (i < 0) return dflt; if (dflt === false || dflt === true) return true; return argv[i + 1]; };
const positional = argv.filter((a, i) => !a.startsWith('--') && !(argv[i - 1]?.startsWith('--') && !['--no-cache', '--whole', '--lean'].includes(argv[i - 1])));
const cmd = positional[0];
const lean = flag('--lean', false);
const opts = { lean, cacheDir: join(here, (lean ? '.cache-lean' : '.cache') + (process.env.SCOUT_EFFORT ? '-' + process.env.SCOUT_EFFORT : '') + (process.env.MAX_THINKING_TOKENS != null ? '-think' + process.env.MAX_THINKING_TOKENS : '')), useCache: !flag('--no-cache', false), concurrency: Number(flag('--concurrency', 4)) };

if (cmd === 'collect') {
  process.stdout.write(collect(positional[1]));
} else if (cmd === 'parse') {
  const bundle = await loadBundle(positional[1]);
  const readings = Object.fromEntries(bundle.items.map((it) => [it.number, parseItem(it)]));
  console.log(JSON.stringify({ readings, snapshot: reconcile(bundle, readings) }, null, 2));
} else if (cmd === 'frontier') {
  const bundle = await loadBundle(positional[1]);
  const snap = reconcile(bundle, Object.fromEntries(bundle.items.map((it) => [it.number, parseItem(it)])));
  for (const m of snap.maps) {
    console.log(`${m.title} (#${m.number}) [${m.bodyForm}] — ${m.tickets.length} tickets, frontier: ${m.frontier.map((n) => `#${n}`).join(', ') || 'empty'}`);
    for (const n of m.frontier) { const t = snap.tickets.find((t) => t.number === n); console.log(`  #${n} ${t.type ?? '?'}: ${t.summary}`); }
    for (const w of [...snap.warnings, ...m.warnings]) console.log(`  ! ${w}`);
    for (const t of snap.tickets.filter((t) => t.map === m.number)) for (const w of t.warnings) console.log(`  ! #${t.number}: ${w}`);
  }
} else if (cmd === 'interpret') {
  const bundle = await loadBundle(positional[1]);
  if (flag('--whole', false)) {
    const r = await interpretWhole(bundle);
    console.log(JSON.stringify({ metrics: r.metrics, value: r.value }, null, 2));
  } else {
    const r = await interpretAll(bundle, opts);
    console.log(JSON.stringify(r, null, 2));
  }
} else if (cmd === 'compare') {
  const bundle = await loadBundle(positional[1]);
  const t0 = performance.now();
  const code = Object.fromEntries(bundle.items.map((it) => [it.number, parseItem(it)]));
  const codeMs = Math.round(performance.now() - t0);
  const model = await interpretAll(bundle, opts);
  const rows = compareReadings(bundle, code, model.readings, opts.lean);
  const { perItem, ...agg } = model.metrics;
  printTable(rows.map((r) => ({ ...r, same: r.same === null ? '' : r.same ? 'same' : 'DIFF' })), ['item', 'field', 'same', 'code', 'model']);
  const diff = rows.filter((r) => r.same === false);
  console.log(`\nfields compared: ${rows.filter((r) => r.same !== null).length}, differing: ${diff.length}`);
  console.log(`code-only: ${codeMs} ms for ${bundle.items.length} items`);
  console.log(`model: ${JSON.stringify(agg)}`);
  for (const p of perItem) if (!p.cached) console.log(`  #${p.number}: ${p.wall} ms, in ${p.input}+${p.cacheWrite}+${p.cacheRead}, out ${p.output} (thinking ${p.thinking}), $${p.cost?.toFixed(4)}`);
  const sc = reconcile(bundle, code), sm = reconcile(bundle, model.readings);
  for (const m of sc.maps) {
    const mm = sm.maps.find((x) => x.number === m.number);
    console.log(`\nfrontier of #${m.number} — code: ${m.frontier.join(', ') || 'empty'} | model: ${mm.frontier.join(', ') || 'empty'} ${norm(m.frontier) === norm(mm.frontier) ? '(same)' : '(DIFF)'}`);
  }
  console.log('\nwarnings (code):');
  for (const w of sc.warnings) console.log(`  ${w}`);
  for (const x of [...sc.maps, ...sc.tickets]) for (const w of x.warnings) console.log(`  #${x.number}: ${w}`);
  console.log('warnings (model):');
  for (const x of [...sm.maps, ...sm.tickets]) for (const w of x.warnings) console.log(`  #${x.number}: ${w}`);
  console.log('\nmodel summaries vs code first sentences:');
  for (const t of sm.tickets) console.log(`  #${t.number} model: ${t.summary}\n      code:  ${sc.tickets.find((x) => x.number === t.number).summary}`);
} else {
  console.error('usage: node scout.mjs collect|parse|frontier|interpret|compare <bundle> [--no-cache] [--concurrency N] [--whole] [--lean]');
  process.exit(2);
}
