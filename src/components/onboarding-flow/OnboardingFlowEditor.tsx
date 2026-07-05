'use client'

import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  Background,
  BaseEdge,
  ConnectionLineType,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type EdgeProps,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './OnboardingFlowEditor.css'
import {
  canMoveNodeToLevel,
  isValidConnectionAgainst,
  moveNodeToSlot,
  nextFreeRow,
  positionFor,
  slotFromPosition,
} from './graphUtils'
import {
  END_NODE_ID,
  START_NODE_ID,
  type BlockData,
  type FlowEdge,
  type FlowNode,
  type GateKind,
  type Slot,
} from './types'

type FlowBlockType = 'requirement' | 'system'
type FlowGateType = 'hard' | 'soft'

export type FlowLibraryBlock = {
  id: string
  name: string
  type: FlowBlockType
  gate: FlowGateType
  requirements: { id: string; name: string }[]
  integrationType?: string
  systemIntegration?: string
  push?: boolean
  pull?: boolean
}

export type FlowPipelineBlock = FlowLibraryBlock & {
  pipelineId: string
  clientKey: string
  order: number
  graphLevel: number
}

export type FlowDependency = {
  id: string
  from: string
  to: string
}

type EdgeData = {
  editable: boolean
  onRemove: (dependencyId: string) => void
}

type OnboardingFlowEditorProps = {
  blocks: FlowPipelineBlock[]
  dependencies: FlowDependency[]
  libraryBlocks: FlowLibraryBlock[]
  usedLibraryBlockIds: Set<string>
  editable: boolean
  selectedBlockId: string | null
  onAddBlock: (block: FlowLibraryBlock, graphLevel?: number) => void
  onSelectBlock: (pipelineId: string | null) => void
  onMoveBlock: (pipelineId: string, graphLevel: number, position: number) => void
  onAddDependency: (from: string, to: string) => void
  onRemoveDependency: (dependencyId: string) => void
  onRemoveBlock: (pipelineId: string) => void
}

const edgeStyle = { stroke: '#94a3b8', strokeWidth: 2 }

function blockSubtitle(block: FlowPipelineBlock | FlowLibraryBlock) {
  if (block.type === 'system') {
    if (block.push && block.pull) return 'push + pull'
    if (block.push) return 'push'
    if (block.pull) return 'pull'
    return block.integrationType || 'system'
  }

  const count = block.requirements.length
  return `${count} req${count === 1 ? '' : 's'} · ${block.gate} gate`
}

function gateForBlock(block: FlowPipelineBlock | FlowLibraryBlock): GateKind {
  return block.type === 'system' ? 'system' : block.gate
}

function isUsedLibraryBlock(block: FlowLibraryBlock, used: Set<string>) {
  return used.has(block.id) || used.has(block.name.trim().toLowerCase())
}

function makeEdge(
  dependency: FlowDependency,
  editable: boolean,
  onRemove: (dependencyId: string) => void,
): FlowEdge {
  return {
    id: dependency.id,
    source: dependency.from,
    target: dependency.to,
    type: 'removable',
    markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    style: edgeStyle,
    data: { editable, onRemove },
  }
}

function parseLibraryBlockId(event: DragEvent) {
  return (
    event.dataTransfer.getData('application/levv-workflow-block') ||
    event.dataTransfer.getData('text/plain') ||
    ''
  )
}

function BlockNode({
  id,
  data,
}: NodeProps<FlowNode>) {
  const isTerminal = data.gate === 'start' || data.gate === 'end'

  if (isTerminal) {
    return (
      <div className={`onboarding-flow-terminal ${data.gate}`}>
        {data.gate === 'end' && (
          <Handle type="target" position={Position.Left} />
        )}
        <div className="onboarding-flow-terminal__dot" />
        <div className="onboarding-flow-terminal__label">{data.title}</div>
        {data.gate === 'start' && (
          <Handle type="source" position={Position.Right} />
        )}
      </div>
    )
  }

  return (
    <div className="onboarding-flow-node">
      <Handle type="target" position={Position.Left} />
      <div
        className={`onboarding-flow-node__card ${data.gate} ${
          data.selected ? 'selected' : ''
        }`}
      >
        <div className="onboarding-flow-node__header">
          <div className="onboarding-flow-node__title">{data.title}</div>
          {data.editable && (
            <button
              type="button"
              className="onboarding-flow-node__remove nodrag"
              aria-label={`Remove ${data.title}`}
              onClick={(event) => {
                event.stopPropagation()
                if (typeof data.onRemove === 'function') {
                  data.onRemove(id)
                }
              }}
            >
              ×
            </button>
          )}
        </div>
        {data.subtitle && (
          <div className="onboarding-flow-node__subtitle">{data.subtitle}</div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function RemovableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}: EdgeProps<FlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })
  const edgeData = data as EdgeData | undefined

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      {edgeData?.editable && (
        <EdgeLabelRenderer>
          <button
            type="button"
            className="onboarding-flow-edge-remove nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onClick={() => edgeData.onRemove(id)}
            aria-label="Remove dependency"
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

const nodeTypes = { block: BlockNode }
const edgeTypes = { removable: RemovableEdge }

function buildNodes(
  blocks: FlowPipelineBlock[],
  selectedBlockId: string | null,
  editable: boolean,
  onRemoveBlock: (pipelineId: string) => void,
): FlowNode[] {
  const maxLevel = blocks.length
    ? Math.max(...blocks.map((block) => Math.max(1, block.graphLevel)))
    : 1
  const rowsByLevel = new Map<number, number>()
  const orderedBlocks = [...blocks].sort((left, right) => left.order - right.order)

  const blockNodes = orderedBlocks.map((block) => {
    const level = Math.max(1, block.graphLevel)
    const row = rowsByLevel.get(level) ?? 0
    rowsByLevel.set(level, row + 1)

    return {
      id: block.pipelineId,
      type: 'block' as const,
      position: positionFor(level, row),
      data: {
        title: block.name,
        subtitle: blockSubtitle(block),
        gate: gateForBlock(block),
        level,
        selected: selectedBlockId === block.pipelineId,
        editable,
        onRemove: onRemoveBlock,
      },
      draggable: editable,
      selectable: editable,
    }
  })

  return [
    {
      id: START_NODE_ID,
      type: 'block',
      position: positionFor(0, 0),
      data: { title: 'Start', gate: 'start', level: 0 },
      draggable: false,
      selectable: false,
      deletable: false,
    },
    ...blockNodes,
    {
      id: END_NODE_ID,
      type: 'block',
      position: positionFor(maxLevel + 1, 0),
      data: { title: 'Active', gate: 'end', level: maxLevel + 1 },
      draggable: false,
      selectable: false,
      deletable: false,
    },
  ]
}

function OnboardingFlowPalette({
  libraryBlocks,
  usedLibraryBlockIds,
  editable,
  onAddBlock,
}: Pick<
  OnboardingFlowEditorProps,
  'libraryBlocks' | 'usedLibraryBlockIds' | 'editable' | 'onAddBlock'
>) {
  return (
    <aside className="onboarding-flow-editor__palette nodrag nopan">
      <div className="onboarding-flow-editor__palette-head">
        <span className="onboarding-flow-editor__palette-title">Blocks</span>
        <span className="onboarding-flow-editor__palette-count">
          {libraryBlocks.length}
        </span>
      </div>
      <div className="onboarding-flow-editor__palette-list">
        {libraryBlocks.map((block) => {
          const isUsed = isUsedLibraryBlock(block, usedLibraryBlockIds)
          const disabled = !editable || isUsed
          return (
            <button
              key={block.id}
              type="button"
              className={`onboarding-flow-editor__palette-item ${gateForBlock(
                block,
              )} ${isUsed ? 'used' : ''}`}
              disabled={disabled}
              draggable={!disabled}
              onClick={() => {
                if (!disabled) onAddBlock(block)
              }}
              onDragStart={(event) => {
                if (disabled) {
                  event.preventDefault()
                  return
                }
                event.dataTransfer.setData(
                  'application/levv-workflow-block',
                  block.id,
                )
                event.dataTransfer.setData('text/plain', block.id)
                event.dataTransfer.effectAllowed = 'copy'
              }}
            >
              <span className="onboarding-flow-editor__palette-name">
                {block.name}
              </span>
              <span className="onboarding-flow-editor__palette-subtitle">
                {isUsed ? 'Added' : blockSubtitle(block)}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}

function OnboardingFlowCanvas(props: OnboardingFlowEditorProps) {
  const {
    blocks,
    dependencies,
    libraryBlocks,
    usedLibraryBlockIds,
    editable,
    selectedBlockId,
    onAddBlock,
    onSelectBlock,
    onMoveBlock,
    onAddDependency,
    onRemoveDependency,
    onRemoveBlock,
  } = props
  const dragStartSlots = useRef<Record<string, Slot>>({})
  const { screenToFlowPosition } = useReactFlow<FlowNode, FlowEdge>()
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FlowNode>([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<FlowEdge>([])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'removable',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: edgeStyle,
    }),
    [],
  )

  const nextNodes = useMemo(
    () => buildNodes(blocks, selectedBlockId, editable, onRemoveBlock),
    [blocks, editable, onRemoveBlock, selectedBlockId],
  )

  const nextEdges = useMemo(
    () =>
      dependencies.map((dependency) =>
        makeEdge(dependency, editable, onRemoveDependency),
      ),
    [dependencies, editable, onRemoveDependency],
  )

  useEffect(() => {
    setNodes(nextNodes)
  }, [nextNodes, setNodes])

  useEffect(() => {
    setEdges(nextEdges)
  }, [nextEdges, setEdges])

  const isValidConnection = useCallback(
    (connection: Connection) =>
      editable && isValidConnectionAgainst(connection, nodes, edges),
    [editable, edges, nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnectionAgainst(connection, nodes, edges)) return
      if (!connection.source || !connection.target) return
      onAddDependency(connection.source, connection.target)
    },
    [edges, nodes, onAddDependency],
  )

  const onNodesChange: OnNodesChange<FlowNode> = useCallback(
    (changes) => {
      if (!editable) return
      onNodesChangeBase(changes)
    },
    [editable, onNodesChangeBase],
  )

  const onEdgesChange: OnEdgesChange<FlowEdge> = useCallback(
    (changes) => {
      if (!editable) return
      onEdgesChangeBase(changes)
    },
    [editable, onEdgesChangeBase],
  )

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = editable ? 'copy' : 'none'
  }, [editable])

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      event.stopPropagation()
      if (!editable) return

      const blockId = parseLibraryBlockId(event)
      const block = libraryBlocks.find((candidate) => candidate.id === blockId)
      if (!block || isUsedLibraryBlock(block, usedLibraryBlockIds)) return

      const flowPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      const requestedSlot = slotFromPosition(flowPosition)
      onAddBlock(block, Math.max(1, requestedSlot.level))
    },
    [
      editable,
      libraryBlocks,
      onAddBlock,
      screenToFlowPosition,
      usedLibraryBlockIds,
    ],
  )

  const onNodeDragStart = useCallback((_: unknown, node: FlowNode) => {
    dragStartSlots.current[node.id] = slotFromPosition(node.position)
  }, [])

  const onNodeDragStop = useCallback(
    (_: unknown, node: FlowNode) => {
      if (node.id === START_NODE_ID || node.id === END_NODE_ID) return

      const originalSlot =
        dragStartSlots.current[node.id] ?? slotFromPosition(node.position)
      const nodesWithDraggedPosition = nodes.map((item) =>
        item.id === node.id ? { ...item, position: node.position } : item,
      )
      const requestedSlot = slotFromPosition(node.position)
      const targetSlot = {
        level: Math.max(1, requestedSlot.level),
        row: requestedSlot.row,
      }

      if (
        !canMoveNodeToLevel(
          node.id,
          targetSlot.level,
          nodesWithDraggedPosition,
          edges,
        )
      ) {
        setNodes((currentNodes) =>
          moveNodeToSlot(currentNodes, node.id, originalSlot, originalSlot),
        )
        delete dragStartSlots.current[node.id]
        return
      }

      const movedNodes = moveNodeToSlot(
        nodesWithDraggedPosition,
        node.id,
        targetSlot,
        originalSlot,
      )
      const movedNode = movedNodes.find((item) => item.id === node.id)
      if (!movedNode) return
      const finalSlot = slotFromPosition(movedNode.position)

      setNodes(movedNodes)
      onMoveBlock(node.id, finalSlot.level, finalSlot.row)
      delete dragStartSlots.current[node.id]
    },
    [edges, nodes, onMoveBlock, setNodes],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!editable) return
      if (event.key !== 'Delete' && event.key !== 'Backspace') return

      const selectedEdgeIds = edges
        .filter((edge) => edge.selected)
        .map((edge) => edge.id)
      const selectedNodeIds = nodes
        .filter(
          (node) =>
            node.selected &&
            node.id !== START_NODE_ID &&
            node.id !== END_NODE_ID,
        )
        .map((node) => node.id)

      if (!selectedEdgeIds.length && !selectedNodeIds.length) return
      event.preventDefault()
      selectedEdgeIds.forEach(onRemoveDependency)
      selectedNodeIds.forEach(onRemoveBlock)
    },
    [editable, edges, nodes, onRemoveBlock, onRemoveDependency],
  )

  return (
    <div className="onboarding-flow-editor" onKeyDown={onKeyDown} tabIndex={0}>
      <div className="onboarding-flow-editor__scroller">
        <div className="onboarding-flow-editor__canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgesDelete={(deletedEdges) => {
              deletedEdges.forEach((edge) => onRemoveDependency(edge.id))
            }}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={(_, node) => {
              if (
                node.id !== START_NODE_ID &&
                node.id !== END_NODE_ID &&
                editable
              ) {
                onSelectBlock(node.id)
              }
            }}
            onPaneClick={() => onSelectBlock(null)}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            isValidConnection={isValidConnection}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={defaultEdgeOptions}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.6}
            maxZoom={1.4}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={editable}
            nodesConnectable={editable}
            elementsSelectable={editable}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.18 }}
          >
            <Background color="#e2e8f0" gap={24} size={1} />
            <Controls showInteractive={false} />
            <OnboardingFlowPalette
              libraryBlocks={libraryBlocks}
              usedLibraryBlockIds={usedLibraryBlockIds}
              editable={editable}
              onAddBlock={onAddBlock}
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingFlowEditor(props: OnboardingFlowEditorProps) {
  return (
    <ReactFlowProvider>
      <OnboardingFlowCanvas {...props} />
    </ReactFlowProvider>
  )
}
