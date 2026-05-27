import { useEffect, useMemo, useState, memo } from 'react';
import { Background, Controls, Handle, MiniMap, Position, ReactFlow } from '@xyflow/react';
import { motion } from 'framer-motion';
import { BrainCircuit, Cable, Filter, Layers3, Sparkles, Target } from 'lucide-react';
import {
  buildArchitectureGraphModel,
  getArchitectureNodeDetails
} from '../utils/architectureInsights.js';

const lensRenderer = memo(LensNode);
const nodeTypes = {
  lens: lensRenderer,
  entry: lensRenderer,
  component: lensRenderer,
  api: lensRenderer,
  middleware: lensRenderer,
  service: lensRenderer,
  database: lensRenderer,
  config: lensRenderer,
  utility: lensRenderer,
  module: lensRenderer,
  external: lensRenderer
};

const typeOrder = ['entry', 'component', 'api', 'middleware', 'service', 'database', 'config', 'utility', 'module', 'external'];

export default function DependencyGraph({ graph, analysis, onExploreFile }) {
  const model = useMemo(() => buildArchitectureGraphModel(graph, analysis), [graph, analysis]);
  const layout = useMemo(() => buildNodeLayout(model.nodes), [model.nodes]);
  const [selectedId, setSelectedId] = useState(model.hotspots[0]?.id || model.nodes[0]?.id || '');
  const [hoveredId, setHoveredId] = useState('');
  const [focusMode, setFocusMode] = useState(true);
  const [isolateMode, setIsolateMode] = useState(false);
  const [activeTypes, setActiveTypes] = useState(() => new Set(model.nodes.map((node) => node.visualType)));

  useEffect(() => {
    const nextTypes = new Set(model.nodes.map((node) => node.visualType));
    setActiveTypes(nextTypes);
    setSelectedId(model.hotspots[0]?.id || model.nodes[0]?.id || '');
    setHoveredId('');
  }, [analysis?.repoId]);

  useEffect(() => {
    if (selectedId && !model.nodeMap.has(selectedId)) {
      setSelectedId(model.hotspots[0]?.id || model.nodes[0]?.id || '');
    }
  }, [model, selectedId]);

  const activeNode = model.nodeMap.get(hoveredId) || model.nodeMap.get(selectedId) || model.hotspots[0] || null;
  const activeContext = activeNode ? getArchitectureNodeDetails(activeNode, model, analysis) : null;
  const relatedIds = new Set(activeNode?.relatedIds || []);
  const visibleIds = new Set();

  for (const node of model.nodes) {
    const typeAllowed = activeTypes.has(node.visualType) || node.id === activeNode?.id;
    const relatedAllowed = !activeNode || !isolateMode || node.id === activeNode.id || relatedIds.has(node.id);
    if (typeAllowed && relatedAllowed) visibleIds.add(node.id);
  }

  const visibleNodes = model.nodes
    .filter((node) => visibleIds.has(node.id))
    .map((node) => {
      const isActive = activeNode?.id === node.id;
      const isRelated = relatedIds.has(node.id);
      const dimmed = Boolean(activeNode) && focusMode && !isActive && !isRelated;

      return {
        ...node,
        type: 'lens',
        position: layout.get(node.id) || { x: 0, y: 0 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          ...node,
          color: node.palette,
          typeLabel: node.typeLabel,
          Icon: node.Icon,
          selected: isActive,
          related: isRelated,
          dimmed,
          detail:
            node.metadata?.routes?.[0]
              ? `${node.metadata.routes[0].method?.toUpperCase()} ${node.metadata.routes[0].path}`
              : node.metadata?.functions?.[0] || node.metadata?.components?.[0] || node.path,
          progress: node.importance,
          role: node.role
        }
      };
    });

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));
  const visibleEdges = model.edges
    .filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target))
    .map((edge) => {
      const sourceNode = model.nodeMap.get(edge.source);
      const targetNode = model.nodeMap.get(edge.target);
      const edgeSelected = activeNode && (edge.source === activeNode.id || edge.target === activeNode.id || relatedIds.has(edge.source) || relatedIds.has(edge.target));
      const stroke = edgeSelected ? (sourceNode?.palette || targetNode?.palette || '#67e8f9') : 'rgba(255,255,255,0.18)';

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: edgeSelected || edge.type === 'imports',
        style: {
          stroke,
          strokeWidth: edgeSelected ? 2.1 : 1.3,
          strokeOpacity: edgeSelected ? 0.7 : 0.28
        },
        labelStyle: {
          fill: '#b9c3d0',
          fontSize: 10
        },
        labelBgStyle: {
          fill: '#0d1117',
          fillOpacity: 0.9
        }
      };
    });

  return (
    <section className="glass-panel overflow-hidden">
      <div className="border-b border-white/10 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyanLens">
              <Cable className="h-4 w-4" />
              Interactive Architecture Canvas
            </div>
            <h2 className="text-2xl font-semibold text-white">Visually explore how the repository is wired</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
              {graph.nodes.length} nodes / {graph.edges.length} edges
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">{graph.parser}</span>
            <button className={toolbarButtonClass(focusMode)} onClick={() => setFocusMode((value) => !value)} type="button">
              <Target className="h-3.5 w-3.5" />
              Focus
            </button>
            <button className={toolbarButtonClass(isolateMode)} onClick={() => setIsolateMode((value) => !value)} type="button">
              <Sparkles className="h-3.5 w-3.5" />
              Isolate
            </button>
          </div>
        </div>
      </div>

      <div className="grid min-h-[760px] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative min-h-[620px] bg-[#080b10]">
          <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap gap-2">
            <TypeFilterChip
              active={activeTypes.size === typeOrder.filter((type) => model.nodes.some((node) => node.visualType === type)).length}
              icon={Layers3}
              label="All"
              onClick={() => setActiveTypes(new Set(model.nodes.map((node) => node.visualType)))}
            />
            {typeOrder
              .filter((type) => model.nodes.some((node) => node.visualType === type))
              .map((type) => (
                <TypeFilterChip
                  active={activeTypes.has(type)}
                  key={type}
                  label={type}
                  onClick={() => {
                    setActiveTypes((current) => {
                      const next = new Set(current);
                      if (next.has(type)) next.delete(type);
                      else next.add(type);
                      return next.size ? next : new Set([type]);
                    });
                  }}
                />
              ))}
          </div>

          <ReactFlow
            colorMode="dark"
            edges={visibleEdges}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
            nodeTypes={nodeTypes}
            nodes={visibleNodes}
            nodesConnectable={false}
            nodesDraggable={false}
            onlyRenderVisibleElements
            onNodeClick={(_event, node) => {
              setSelectedId(node.id);
              onExploreFile?.(node.data.path);
            }}
            onNodeMouseEnter={(_event, node) => setHoveredId(node.id)}
            onNodeMouseLeave={() => setHoveredId('')}
            panOnScroll
            panOnDrag
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
            selectionOnDrag={false}
            zoomOnPinch
            zoomOnScroll
          >
            <Background color="rgba(103,232,249,0.12)" gap={28} size={1} />
            <MiniMap
              maskColor="rgba(7,9,13,0.72)"
              nodeColor={(node) => node.data.palette || '#67e8f9'}
              pannable
              zoomable
            />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="border-t border-white/10 bg-white/[0.02] xl:border-l xl:border-t-0">
          <div className="border-b border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
              <BrainCircuit className="h-4 w-4 text-cyanLens" />
              Architecture Context
            </div>
          </div>

          <div className="max-h-[690px] overflow-auto p-4">
            {activeContext ? <NodeDetailsPanel node={activeContext} onExploreFile={onExploreFile} hotspots={model.hotspots} /> : null}
            {!activeContext ? <EmptyGraphPanel hotspots={model.hotspots} onSelectNode={(node) => setSelectedId(node.id)} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function NodeDetailsPanel({ node, onExploreFile, hotspots }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">{node.typeLabel}</div>
            <h3 className="mt-2 text-xl font-semibold text-white">{node.label}</h3>
            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/38">{node.path}</p>
          </div>
          <div className="shrink-0 rounded-full border border-mintLens/20 bg-mintLens/10 px-3 py-2 text-xs text-mintLens">
            {node.importance}%
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyanLens via-mintLens to-amberLens" style={{ width: `${node.importance}%` }} />
        </div>
      </div>

      <InfoSection title="Architectural role" copy={node.architecturalRole} />
      <InfoSection title="AI explanation" copy={node.explanation} />

      <InfoList title="Connected to" items={node.relatedFiles} onSelect={onExploreFile} />
      <InfoList title="Dependency chain" items={node.dependencyChain} onSelect={onExploreFile} />

      {node.imports?.length ? <ChipSection title="Imports" items={node.imports.slice(0, 8)} /> : null}
      {node.exports?.length ? <ChipSection title="Exports" items={node.exports.slice(0, 8)} /> : null}

      <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <Target className="h-4 w-4 text-cyanLens" />
          Related hotspots
        </div>
        <div className="space-y-2">
          {hotspots.slice(0, 3).map((hotspot) => (
            <button
              className={`w-full rounded-[10px] border px-3 py-2 text-left text-sm transition ${hotspot.id === node.id ? 'border-cyanLens/35 bg-cyanLens/10 text-white' : 'border-white/10 bg-black/20 text-white/72 hover:border-cyanLens/25 hover:text-white'}`}
              key={hotspot.id}
              onClick={() => onExploreFile?.(hotspot.path)}
              type="button"
            >
              <div className="truncate">{hotspot.path}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/38">{hotspot.importance}% importance</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyGraphPanel({ hotspots, onSelectNode }) {
  return (
    <div className="space-y-4">
      <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">Hover or click a node</div>
        <p className="text-sm leading-6 text-white/58">The panel will show imports, exports, dependency chains, and an AI explanation for the selected file.</p>
      </div>

      <div className="rounded-[12px] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">
          <Target className="h-4 w-4 text-mintLens" />
          Hotspots
        </div>
        <div className="space-y-2">
          {hotspots.slice(0, 5).map((hotspot) => (
            <button
              className="w-full rounded-[10px] border border-white/10 bg-black/20 p-3 text-left text-sm text-white/72 transition hover:border-cyanLens/35 hover:text-white"
              key={hotspot.id}
              onClick={() => onSelectNode(hotspot)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="truncate">{hotspot.path}</span>
                <span className="shrink-0 rounded-full border border-mintLens/20 bg-mintLens/10 px-2 py-1 text-[11px] text-mintLens">{hotspot.importance}%</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoSection({ title, copy }) {
  if (!copy) return null;

  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">{title}</div>
      <p className="text-sm leading-6 text-white/60">{copy}</p>
    </div>
  );
}

function InfoList({ title, items = [], onSelect }) {
  if (!items.length) return null;

  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">{title}</div>
      <div className="space-y-2">
        {items.map((item) => (
          <button
            className="w-full rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-left text-sm text-white/68 transition hover:border-cyanLens/35 hover:text-white"
            key={item}
            onClick={() => onSelect?.(item)}
            type="button"
          >
            <div className="truncate">{item}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipSection({ title, items = [] }) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/42">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/58" key={item}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TypeFilterChip({ active, label, onClick, icon: Icon }) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${active ? 'border-cyanLens/35 bg-cyanLens/10 text-cyanLens' : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white'}`}
      onClick={onClick}
      type="button"
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function toolbarButtonClass(active) {
  return `inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.16em] transition ${active ? 'border-mintLens/35 bg-mintLens/10 text-mintLens' : 'border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white'}`;
}

function buildNodeLayout(nodes) {
  const buckets = new Map();

  for (const node of nodes) {
    const column = layoutColumnForType(node.visualType);
    const current = buckets.get(column) || [];
    current.push(node);
    buckets.set(column, current);
  }

  const layout = new Map();
  const columns = [...buckets.keys()].sort((a, b) => a - b);

  for (const column of columns) {
    const items = buckets.get(column) || [];
    items.sort((a, b) => b.importance - a.importance || a.label.localeCompare(b.label));

    items.forEach((node, index) => {
      layout.set(node.id, {
        x: column * 250,
        y: index * 120
      });
    });
  }

  return layout;
}

function layoutColumnForType(type) {
  switch (type) {
    case 'entry':
      return 0;
    case 'component':
    case 'config':
      return 1;
    case 'api':
    case 'middleware':
      return 2;
    case 'service':
      return 3;
    case 'database':
      return 4;
    case 'utility':
      return 2;
    case 'external':
      return 5;
    default:
      return 2;
  }
}

function LensNode({ data }) {
  const Icon = data.Icon;
  const detail = data.detail || data.path;
  const muted = data.dimmed ? 0.34 : 1;
  const borderColor = data.selected ? `${data.color}CC` : data.related ? `${data.color}88` : `${data.color}55`;
  const background = data.selected
    ? `linear-gradient(180deg, ${data.color}20, rgba(13,17,23,0.96))`
    : data.related
      ? `linear-gradient(180deg, ${data.color}16, rgba(13,17,23,0.92))`
      : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(13,17,23,0.96))';

  return (
    <motion.div
      className="min-w-[220px] max-w-[250px]"
      initial={false}
      animate={{ scale: data.selected ? 1.04 : data.related ? 1.02 : 1 }}
      transition={{ duration: 0.18 }}
      style={{ opacity: muted }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-transparent" />
      <div className="border px-3 py-3 shadow-panel" style={{ borderColor, background }}>
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border" style={{ borderColor: `${data.color}55`, background: `${data.color}16` }}>
            <Icon className="h-4 w-4" style={{ color: data.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">{data.label}</div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/38">{data.typeLabel}</div>
          </div>
          <div className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/48">
            {data.progress}%
          </div>
        </div>

        <div className="mt-3 truncate border-t border-white/10 pt-2 text-xs text-white/42">{detail}</div>

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyanLens via-mintLens to-amberLens" style={{ width: `${data.progress}%` }} />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-transparent" />
    </motion.div>
  );
}
