import type { Edge, Node } from '@xyflow/react'

export const START_NODE_ID = '__start__'
export const END_NODE_ID = '__end__'

export type GateKind = 'hard' | 'soft' | 'system' | 'start' | 'end'

export interface BlockData extends Record<string, unknown> {
  title: string
  subtitle?: string
  gate: GateKind
  level: number
  selected?: boolean
  editable?: boolean
}

export type FlowNode = Node<BlockData, 'block'>
export type FlowEdge = Edge

export type PaletteBlock = {
  title: string
  subtitle?: string
  gate: Exclude<GateKind, 'start' | 'end'>
}

export type Slot = {
  level: number
  row: number
}
