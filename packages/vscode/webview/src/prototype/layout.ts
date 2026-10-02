// PROTOTYPE — two ways to place a map's graph: ~70 hand-rolled lines, or dagre.
import dagre from '@dagrejs/dagre'

export interface LNode {
  id: string
  w: number
  h: number
}
export interface LEdge {
  from: string
  to: string
  /** Used for placement only, never drawn. */
  hidden?: boolean
}
export interface Placed {
  x: number
  y: number
  w: number
  h: number
}
export interface Layout {
  nodes: Map<string, Placed>
  width: number
  height: number
}
export type Dir = 'LR' | 'TB'

const GAP_MAIN = 56
const GAP_CROSS = 14
const PAD = 16

/** Layer = longest path from a source. What any layered-graph library computes first. */
export function longestPath(nodes: LNode[], edges: LEdge[]): Map<string, number> {
  const layer = new Map<string, number>()
  const visit = (id: string): number => {
    const known = layer.get(id)
    if (known !== undefined) return known
    const preds = edges.filter((e) => e.to === id).map((e) => visit(e.from))
    const value = preds.length ? Math.max(...preds) + 1 : 0
    layer.set(id, value)
    return value
  }
  nodes.forEach((n) => visit(n.id))
  return layer
}

/** Stack nodes in the given layers, ordered by a few barycenter sweeps to cut crossings. */
export function layered(
  nodes: LNode[],
  edges: LEdge[],
  layerOf: Map<string, number>,
  dir: Dir,
): Layout {
  const count = Math.max(...layerOf.values()) + 1
  const layers: LNode[][] = Array.from({ length: count }, () => [])
  for (const node of nodes) layers[layerOf.get(node.id)!]!.push(node)

  const position = new Map<string, number>()
  const index = (): void =>
    layers.forEach((l) => l.forEach((n, i) => position.set(n.id, i / l.length)))
  index()
  for (let sweep = 0; sweep < 6; sweep++) {
    const down = sweep % 2 === 0
    for (const l of down ? layers : layers.toReversed()) {
      const bary = (n: LNode): number => {
        const linked = edges
          .filter((e) => (down ? e.to : e.from) === n.id)
          .map((e) => position.get(down ? e.from : e.to)!)
        return linked.length
          ? linked.reduce((a, b) => a + b, 0) / linked.length
          : position.get(n.id)!
      }
      const scored = new Map(l.map((n) => [n.id, bary(n)]))
      l.sort((a, b) => scored.get(a.id)! - scored.get(b.id)!)
      index()
    }
  }

  const main = (n: LNode): number => (dir === 'LR' ? n.w : n.h)
  const cross = (n: LNode): number => (dir === 'LR' ? n.h : n.w)
  const span = (l: LNode[]): number =>
    l.reduce((sum, n) => sum + cross(n), 0) + GAP_CROSS * (l.length - 1)
  const widest = Math.max(...layers.map(span))

  const placed = new Map<string, Placed>()
  let offset = PAD
  for (const l of layers) {
    let at = PAD + (dir === 'LR' ? 0 : (widest - span(l)) / 2)
    for (const n of l) {
      placed.set(
        n.id,
        dir === 'LR' ? { x: offset, y: at, w: n.w, h: n.h } : { x: at, y: offset, w: n.w, h: n.h },
      )
      at += cross(n) + GAP_CROSS
    }
    offset += Math.max(0, ...l.map(main)) + GAP_MAIN
  }
  const along = offset - GAP_MAIN + PAD
  const across = widest + PAD * 2
  return dir === 'LR'
    ? { nodes: placed, width: along, height: across }
    : { nodes: placed, width: across, height: along }
}

export function dagreLayout(nodes: LNode[], edges: LEdge[], dir: Dir): Layout {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: dir, nodesep: GAP_CROSS, ranksep: GAP_MAIN, marginx: PAD, marginy: PAD })
  g.setDefaultEdgeLabel(() => ({}))
  for (const n of nodes) g.setNode(n.id, { width: n.w, height: n.h })
  for (const e of edges) g.setEdge(e.from, e.to)
  dagre.layout(g)
  const placed = new Map<string, Placed>()
  for (const n of nodes) {
    const at = g.node(n.id)
    placed.set(n.id, { x: at.x - n.w / 2, y: at.y - n.h / 2, w: n.w, h: n.h })
  }
  const graph = g.graph()
  return { nodes: placed, width: graph.width ?? 0, height: graph.height ?? 0 }
}

export function edgePath(from: Placed, to: Placed, dir: Dir): string {
  if (dir === 'LR') {
    const x1 = from.x + from.w
    const y1 = from.y + from.h / 2
    const x2 = to.x
    const y2 = to.y + to.h / 2
    const bend = Math.max(24, (x2 - x1) / 2)
    return `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`
  }
  const x1 = from.x + from.w / 2
  const y1 = from.y + from.h
  const x2 = to.x + to.w / 2
  const y2 = to.y
  const bend = Math.max(24, (y2 - y1) / 2)
  return `M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`
}
