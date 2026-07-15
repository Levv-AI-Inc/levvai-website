import type { FlowEdge, FlowNode, Slot } from './types'
import { END_NODE_ID, START_NODE_ID } from './types'

export const LEVEL_WIDTH = 280
export const ROW_HEIGHT = 105
export const LEFT = 60
export const TOP = 55

type ConnectionLike = {
  source?: string | null
  target?: string | null
}

export function positionFor(level: number, row: number) {
  return {
    x: LEFT + Math.max(0, level) * LEVEL_WIDTH,
    y: TOP + Math.max(0, row) * ROW_HEIGHT,
  }
}

export function levelFromX(x: number) {
  return Math.max(0, Math.round((x - LEFT) / LEVEL_WIDTH))
}

export function rowFromY(y: number) {
  return Math.max(0, Math.round((y - TOP) / ROW_HEIGHT))
}

export function slotFromPosition(position: { x: number; y: number }): Slot {
  return {
    level: levelFromX(position.x),
    row: rowFromY(position.y),
  }
}

function nodeLevel(node: FlowNode) {
  return typeof node.data.level === 'number'
    ? node.data.level
    : slotFromPosition(node.position).level
}

function occupiedRows(
  nodes: FlowNode[],
  level: number,
  ignoreNodeId?: string,
) {
  return new Set(
    nodes
      .filter((node) => node.id !== ignoreNodeId && nodeLevel(node) === level)
      .map((node) => slotFromPosition(node.position).row),
  )
}

export function nextFreeRow(
  nodes: FlowNode[],
  level: number,
  requestedRow: number,
  ignoreNodeId?: string,
) {
  const occupied = occupiedRows(nodes, level, ignoreNodeId)
  let row = Math.max(0, requestedRow)

  while (occupied.has(row)) {
    row += 1
  }

  return row
}

export function wouldCreateCycle(
  sourceId: string,
  targetId: string,
  edges: FlowEdge[],
) {
  const adjacency = new Map<string, string[]>()

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue
    const outgoing = adjacency.get(edge.source) ?? []
    outgoing.push(edge.target)
    adjacency.set(edge.source, outgoing)
  }

  const stack = [targetId]
  const seen = new Set<string>()

  while (stack.length) {
    const current = stack.pop()
    if (!current || seen.has(current)) continue
    if (current === sourceId) return true
    seen.add(current)
    stack.push(...(adjacency.get(current) ?? []))
  }

  return false
}

export function isValidConnectionAgainst(
  connection: ConnectionLike,
  nodes: FlowNode[],
  edges: FlowEdge[],
) {
  const sourceId = connection.source
  const targetId = connection.target

  if (!sourceId || !targetId) return false
  if (sourceId === targetId) return false
  if (targetId === START_NODE_ID) return false
  if (sourceId === END_NODE_ID) return false
  if (
    edges.some((edge) => edge.source === sourceId && edge.target === targetId)
  ) {
    return false
  }

  const source = nodes.find((node) => node.id === sourceId)
  const target = nodes.find((node) => node.id === targetId)
  if (!source || !target) return false
  if (
    sourceId !== START_NODE_ID &&
    targetId !== END_NODE_ID &&
    nodeLevel(source) >= nodeLevel(target)
  ) {
    return false
  }

  return !wouldCreateCycle(sourceId, targetId, edges)
}

export function canMoveNodeToLevel(
  nodeId: string,
  newLevel: number,
  nodes: FlowNode[],
  edges: FlowEdge[],
) {
  if (newLevel < 0) return false
  if (nodeId === START_NODE_ID || nodeId === END_NODE_ID) return false
  if (!nodes.some((node) => node.id === nodeId)) return false

  for (const edge of edges) {
    if (!edge.source || !edge.target) continue

    if (edge.source === nodeId) {
      const target = nodes.find((node) => node.id === edge.target)
      if (!target || newLevel >= nodeLevel(target)) return false
    }

    if (edge.target === nodeId) {
      const source = nodes.find((node) => node.id === edge.source)
      if (!source || nodeLevel(source) >= newLevel) return false
    }
  }

  return true
}

export function moveNodeToSlot(
  nodes: FlowNode[],
  nodeId: string,
  requestedSlot: Slot,
  originalSlot: Slot,
) {
  const moving = nodes.find((node) => node.id === nodeId)
  if (!moving) return nodes

  const normalizedSlot = {
    level: Math.max(0, requestedSlot.level),
    row: Math.max(0, requestedSlot.row),
  }
  const original = {
    level: Math.max(0, originalSlot.level),
    row: Math.max(0, originalSlot.row),
  }

  const target = nodes.find((node) => {
    const slot = slotFromPosition(node.position)
    return (
      node.id !== nodeId &&
      nodeLevel(node) === normalizedSlot.level &&
      slot.row === normalizedSlot.row
    )
  })

  if (target && normalizedSlot.level === original.level) {
    return nodes.map((node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          position: positionFor(normalizedSlot.level, normalizedSlot.row),
          data: { ...node.data, level: normalizedSlot.level },
        }
      }

      if (node.id === target.id) {
        return {
          ...node,
          position: positionFor(original.level, original.row),
          data: { ...node.data, level: original.level },
        }
      }

      return node
    })
  }

  const row =
    target && normalizedSlot.level !== original.level
      ? nextFreeRow(nodes, normalizedSlot.level, normalizedSlot.row, nodeId)
      : normalizedSlot.row

  return nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          position: positionFor(normalizedSlot.level, row),
          data: { ...node.data, level: normalizedSlot.level },
        }
      : node,
  )
}
