/**
 * The words the sanitizer keeps: everything else a tracker file holds is replaced.
 *
 * The list is the allowlist of map 130's Notes: header keys, state words, section headings,
 * `wayfinder:` types, triage roles and AFK/HITL. Signal words are kept wherever they stand.
 * Soft words (function words, small numbers) are kept only near a signal word, so a kept
 * annotation still reads as one (`closed by 07`) while plain prose collapses. Every word here
 * is generic: none names the tracker's project, its people or its domain.
 */
const SIGNAL = `
  open opened opens closed close closes closing done resolved resolve resolves resolution
  resolutions wontfix claimed claim claims unclaimed reopened reopen reopens superseded moved
  blocked unblocked block blocks blocking blocker blockers frontier empty charted recharted
  redrawn redrew destination reached route walked progress ready agent human needs info triage
  afk hitl map maps ticket tickets issue issues answer answers question questions comment
  comments notes decisions decision decided specified scope acceptance label labels type
  assignee parent wayfinder research prototype grilling grilled task tasks spec prd session
  autonomous uncommitted committed working tree gates green smoke pass passed fail failed todo
  pending checklist sources context problem plan proof verification premise revisions rulings
  reshaped facts intake sweep summary recommendation subagent handoff findings acceptance
  takeable shipped implemented confirmed overturned owed verdict status
`

const SOFT = `
  the and or with by of on in to at for from as is are be it its this that see below above now
  still never all only no none not after before into via but if when than both each every same
  new here under over so far yet out re one per line then once until user first second
  previous later live fully what was were built build changed happens expected update read
  depend depends why step steps item items child children files file date dates researched
  sections section tests test docs live left stays stay keep kept drop dropped fixed red yes
  a an
  details summary br code pre kbd sub sup
`

/** The tracker's second language: its state words and resolution headings, all signal. */
const SECOND_LANGUAGE = `
  resolução resolucao resolvido resolvida resolvidos resolvidas concluído concluída concluídos
  concluídas fechado fechada fechados fechadas aberto aberta abertos abertas reaberto encerrado
  encerrada encerrados encerradas pendente pendentes bloqueado bloqueada feito execução execucao
  sessão sessao autônoma autonoma resposta respostas pergunta perguntas comentário comentários
  decisão decisões decisoes
`

const words = (list: string): ReadonlySet<string> =>
  new Set(list.split(/\s+/).filter((word) => word.length > 0))

/** Words kept wherever they stand, lower-case. */
export const SIGNAL_WORDS: ReadonlySet<string> = new Set([
  ...words(SIGNAL),
  ...words(SECOND_LANGUAGE),
])

/** Words kept only near a signal word, lower-case. */
export const SOFT_WORDS: ReadonlySet<string> = words(SOFT)

/** The kept words of the second language: each must be on the leak check's reviewed list. */
export const SECOND_LANGUAGE_WORDS: ReadonlySet<string> = words(SECOND_LANGUAGE)

/** File and directory names kept as they are: the names the scout and its readers look for. */
export const KEPT_NAMES: ReadonlySet<string> = new Set([
  'issues',
  'assets',
  'research',
  'MAP.md',
  'map.md',
  'PRD.md',
  'HANDOFF.md',
  'README.md',
  'FINDINGS.md',
  'findings.md',
  'AMENDMENTS.md',
])
