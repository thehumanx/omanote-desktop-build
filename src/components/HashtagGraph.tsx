import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { hashtagColor } from "../lib/hashtags";
import { HashtagCombobox } from "./HashtagCombobox";
import { CanvasEventBlock } from "./CanvasEventBlock";
import { CanvasNoteBlock } from "./CanvasNoteBlock";
import { CanvasTodoBlock } from "./CanvasTodoBlock";
import { BookmarkCard } from "./cards";
import { ModalPortal } from "./ModalPortal";
import { useApp } from "../app/AppProvider";
import { useTheme } from "../contexts/ThemeContext";
import { cn } from "./ui";
import { useDrawerDrag } from "../lib/useDrawerDrag";
import { GripHorizontal, X } from "lucide-react";
import type { BookmarkItem, EventEntry, NoteItem, TodoItem } from "@omanote/shared";
import { SuppressHashtagTooltipCtx } from "./HashtagChip";

const HASHTAG_GRAPH_TAG_LIMIT = 300;
const HASHTAG_GRAPH_USAGE_LIMIT = 1000;

// ---------------------------------------------------------------------------
// Deterministic seeded RNG
// ---------------------------------------------------------------------------

function seededRng(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    h = (Math.imul(h ^ (h >>> 16), 0x45d9f3b)) | 0;
    return (h >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Chip geometry
// ---------------------------------------------------------------------------

const FONT_SIZE = 12;
const CHAR_WIDTH = 7.2;
const CHIP_H = 30;
const CHIP_PAD_X = 14;
const HOVER_PAD = 7;

/** Full text rendered inside the chip, e.g. "#design · 4" */
function chipLabel(label: string, count: number): string {
  return count > 0 ? `#${label} · ${count}` : `#${label}`;
}

function chipWidth(label: string, count: number): number {
  return Math.max(64, chipLabel(label, count).length * CHAR_WIDTH + CHIP_PAD_X * 2);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimNode {
  id: string;     // nameLower
  label: string;
  convexId: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface SimEdge {
  a: number;
  b: number;
  weight: number;
}

type GraphArtifactType = "note" | "todo" | "event" | "bookmark";
type HashtagArtifact =
  | { key: string; type: "note"; createdAt: number; data: NoteItem }
  | { key: string; type: "todo"; createdAt: number; data: TodoItem }
  | { key: string; type: "bookmark"; createdAt: number; data: BookmarkItem }
  | { key: string; type: "event"; createdAt: number; data: EventEntry };

export function normalizeGraphArtifactType(type: string): Exclude<GraphArtifactType, "bookmark"> {
  if (type === "note" || type === "todo" || type === "event") {
    return type;
  }
  return "event";
}

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------

const REPULSION = 5000;
const SPRING_K = 0.025;
const GRAVITY = 0.012;
const DAMPING = 0.82;

function physicsStep(nodes: SimNode[], edges: SimEdge[]) {
  const n = nodes.length;
  for (let i = 0; i < n; i++) {
    const ni = nodes[i];
    let fx = 0, fy = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const nj = nodes[j];
      const dx = ni.x - nj.x, dy = ni.y - nj.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { fx += (Math.random() - 0.5) * 2; fy += (Math.random() - 0.5) * 2; continue; }
      const d = Math.sqrt(d2), f = REPULSION / d2;
      fx += (dx / d) * f; fy += (dy / d) * f;
    }
    for (const edge of edges) {
      if (edge.a !== i && edge.b !== i) continue;
      const other = nodes[edge.a === i ? edge.b : edge.a];
      const dx = other.x - ni.x, dy = other.y - ni.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const targetLen = ni.r + other.r + 60;
      const f = SPRING_K * (d - targetLen);
      fx += (dx / d) * f; fy += (dy / d) * f;
    }
    fx -= ni.x * GRAVITY; fy -= ni.y * GRAVITY;
    ni.vx = (ni.vx + fx) * DAMPING;
    ni.vy = (ni.vy + fy) * DAMPING;
  }
  for (const node of nodes) { node.x += node.vx; node.y += node.vy; }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface HashtagGraphProps {
  filterHashtags?: string[];
  onFilterHashtagsChange?: (selected: string[]) => void;
  showFilter?: boolean;
}

export function HashtagGraph({
  filterHashtags: controlledFilterHashtags,
  onFilterHashtagsChange,
  showFilter = true,
}: HashtagGraphProps = {}) {
  const { state, dispatch } = useApp();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const allHashtags = useQuery(api.hashtags.listAllUserHashtags, { limit: HASHTAG_GRAPH_TAG_LIMIT });
  const allUsages   = useQuery(api.hashtags.getAllHashtagUsages, { limit: HASHTAG_GRAPH_USAGE_LIMIT });

  const [internalFilterHashtags, setInternalFilterHashtags] = useState<string[]>([]);
  const filterHashtags = controlledFilterHashtags ?? internalFilterHashtags;
  const setFilterHashtags = onFilterHashtagsChange ?? setInternalFilterHashtags;
  const [pan,  setPan]  = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const transformRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  transformRef.current.zoom = zoom;
  transformRef.current.panX = pan.x;
  transformRef.current.panY = pan.y;

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId,  setHoveredNodeId]  = useState<string | null>(null);

  const [displayNodes, setDisplayNodes] = useState<SimNode[]>([]);
  const [displayEdges, setDisplayEdges] = useState<SimEdge[]>([]);
  const simNodesRef    = useRef<SimNode[]>([]);
  const simEdgesRef    = useRef<SimEdge[]>([]);
  const animFrameRef   = useRef<number | null>(null);
  const frameCountRef  = useRef(0);

  // Pointer interaction refs
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const hasDraggedRef = useRef(false);
  const nodeDragRef  = useRef<{
    nodeId: string;
    startScreenX: number; startScreenY: number;
    startSimX: number;    startSimY: number;
  } | null>(null);
  const bgDragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const activeTouchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    startDistance: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    startMidX: number;
    startMidY: number;
  } | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });
  const closeArtifactSheet = useCallback(() => setSelectedNodeId(null), []);
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(closeArtifactSheet);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      setGraphSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // External focus event used by hashtag tooltips to open the graph
  // with a single hashtag pre-selected in the combobox filter.
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ nameLower?: string }>;
      const nameLower = customEvent.detail?.nameLower?.trim();
      if (!nameLower) return;
      setFilterHashtags([nameLower]);
      setSelectedNodeId(null);
    };

    window.addEventListener("omanote:explore-focus-hashtag", handler as EventListener);
    return () => window.removeEventListener("omanote:explore-focus-hashtag", handler as EventListener);
  }, [setFilterHashtags]);

  // ---------------------------------------------------------------------------
  // Build graph
  // ---------------------------------------------------------------------------

  const graphData = useMemo(() => {
    if (!allHashtags || !allUsages) return null;

    const visible = filterHashtags.length > 0
      ? allHashtags.filter((h) => filterHashtags.includes(h.nameLower))
      : allHashtags;

    if (visible.length === 0) return { nodes: [], edges: [] };

    const usageCount = new Map<string, number>();
    for (const u of allUsages) {
      if (!visible.some((h) => h.nameLower === u.hashtagName)) continue;
      usageCount.set(u.hashtagName, (usageCount.get(u.hashtagName) ?? 0) + 1);
    }

    const byArtifact = new Map<string, Set<string>>();
    for (const u of allUsages) {
      if (!visible.some((h) => h.nameLower === u.hashtagName)) continue;
      if (!byArtifact.has(u.artifactId)) byArtifact.set(u.artifactId, new Set());
      byArtifact.get(u.artifactId)!.add(u.hashtagName);
    }

    const edgeWeights = new Map<string, number>();
    for (const [, names] of byArtifact) {
      const arr = [...names];
      for (let i = 0; i < arr.length; i++)
        for (let j = i + 1; j < arr.length; j++) {
          const key = [arr[i], arr[j]].sort().join("||");
          edgeWeights.set(key, (edgeWeights.get(key) ?? 0) + 1);
        }
    }

    const nodes: SimNode[] = visible.map((h) => {
      const count = usageCount.get(h.nameLower) ?? 0;
      const cw = chipWidth(h.name, count);
      const r = cw / 2 + 8;
      const rng = seededRng(h._id);
      const angle = rng() * Math.PI * 2;
      const dist  = 80 + rng() * 130;
      return { id: h.nameLower, label: h.name, convexId: h._id, count,
               x: Math.cos(angle) * dist, y: Math.sin(angle) * dist,
               vx: 0, vy: 0, r };
    });

    const idxMap = new Map(nodes.map((n, i) => [n.id, i]));
    const edges: SimEdge[] = [];
    for (const [key, weight] of edgeWeights) {
      const [a, b] = key.split("||");
      const ai = idxMap.get(a), bi = idxMap.get(b);
      if (ai !== undefined && bi !== undefined) edges.push({ a: ai, b: bi, weight });
    }

    return { nodes, edges };
  }, [allHashtags, allUsages, filterHashtags]);

  const categoryNameById = useMemo(
    () => new Map(state.bookmarkCategories.map((category) => [category.id, category.name] as const)),
    [state.bookmarkCategories],
  );

  const selectedHashtag = useMemo(
    () => allHashtags?.find((hashtag) => hashtag.nameLower === selectedNodeId) ?? null,
    [allHashtags, selectedNodeId],
  );

  const selectedArtifacts = useMemo<HashtagArtifact[]>(() => {
    if (!allUsages || !selectedNodeId) return [];

    return allUsages
      .filter((usage) => usage.hashtagName === selectedNodeId)
      .map((usage): HashtagArtifact | null => {
        const artifactType = usage.artifactType as string;

        if (artifactType === "note") {
          const note = state.notes.find((item) => item.id === usage.artifactId);
          return note ? { key: `note:${note.id}`, type: "note", createdAt: note.createdAt, data: note } : null;
        }

        if (artifactType === "todo") {
          const todo = state.todos.find((item) => item.id === usage.artifactId && !item.deletedAt);
          return todo ? { key: `todo:${todo.id}`, type: "todo", createdAt: todo.createdAt, data: todo } : null;
        }

        if (artifactType === "bookmark") {
          const bookmark = state.bookmarks.find((item) => item.id === usage.artifactId);
          return bookmark ? { key: `bookmark:${bookmark.id}`, type: "bookmark", createdAt: bookmark.createdAt, data: bookmark } : null;
        }

        if (normalizeGraphArtifactType(artifactType) === "event") {
          const event = state.events.find((item) => item.id === usage.artifactId && !item.deletedAt);
          return event ? { key: `event:${event.id}`, type: "event", createdAt: event.createdAt, data: event } : null;
        }

        return null;
      })
      .filter((artifact): artifact is HashtagArtifact => Boolean(artifact))
      .filter((artifact, index, array) => array.findIndex((a) => a.key === artifact.key) === index)
      .sort((left, right) => right.createdAt - left.createdAt);
  }, [allUsages, selectedNodeId, state.bookmarks, state.events, state.notes, state.todos]);

  // ---------------------------------------------------------------------------
  // Simulation lifecycle
  // ---------------------------------------------------------------------------

  // Close the sheet only when the selected hashtag is filtered out, not on every data update.
  useEffect(() => {
    if (!selectedNodeId || filterHashtags.length === 0) return;
    if (!filterHashtags.includes(selectedNodeId)) setSelectedNodeId(null);
  }, [filterHashtags, selectedNodeId]);

  useEffect(() => {
    if (!graphData) return;
    if (animFrameRef.current !== null) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }

    const nodes = graphData.nodes.map((n) => ({ ...n }));
    simNodesRef.current  = nodes;
    simEdgesRef.current  = graphData.edges;
    frameCountRef.current = 0;
    setDisplayNodes([...nodes]);
    setDisplayEdges(graphData.edges);

    const tick = () => {
      if (frameCountRef.current >= 200) return;
      physicsStep(simNodesRef.current, simEdgesRef.current);
      frameCountRef.current++;
      setDisplayNodes([...simNodesRef.current]);
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current); };
  }, [graphData]);

  // ---------------------------------------------------------------------------
  // Node click -> open artifact sheet
  // ---------------------------------------------------------------------------

  const handleNodeClick = useCallback((nodeId: string) => {
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
      return;
    }

    const hashtagNode = simNodesRef.current.find((n) => n.id === nodeId);
    if (!hashtagNode) return;
    setSelectedNodeId(nodeId);
  }, [selectedNodeId]);

  // ---------------------------------------------------------------------------
  // Pointer handlers (unified on SVG — distinguishes node drag vs canvas pan)
  // ---------------------------------------------------------------------------

  const stopSimulation = () => {
    if (animFrameRef.current !== null) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
  };

  const onSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    hasDraggedRef.current = false;
    if (e.pointerType === "touch") {
      activeTouchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchPointsRef.current.size === 2) {
        const [p1, p2] = [...activeTouchPointsRef.current.values()];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        pinchRef.current = {
          startDistance: Math.max(1, Math.hypot(dx, dy)),
          startZoom: zoom,
          startPanX: pan.x,
          startPanY: pan.y,
          startMidX: (p1.x + p2.x) / 2,
          startMidY: (p1.y + p2.y) / 2,
        };
        nodeDragRef.current = null;
        bgDragRef.current = null;
        hasDraggedRef.current = true;
      }
    }

    // Hit-test: did the pointer land on a hashtag node?
    const nodeEl = (e.target as Element).closest("[data-nodeid]");
    if (nodeEl) {
      const nodeId = nodeEl.getAttribute("data-nodeid")!;
      const node   = simNodesRef.current.find((n) => n.id === nodeId);
      if (node) {
        stopSimulation();
        nodeDragRef.current = {
          nodeId,
          startScreenX: e.clientX, startScreenY: e.clientY,
          startSimX: node.x,       startSimY: node.y,
        };
        bgDragRef.current = null;
        (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
        return;
      }
    }

    // Background pan
    bgDragRef.current  = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    nodeDragRef.current = null;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };

  const onSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch") {
      activeTouchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchPointsRef.current.size >= 2) {
        const [p1, p2] = [...activeTouchPointsRef.current.values()];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        if (!pinchRef.current) {
          pinchRef.current = {
            startDistance: distance,
            startZoom: zoom,
            startPanX: pan.x,
            startPanY: pan.y,
            startMidX: (p1.x + p2.x) / 2,
            startMidY: (p1.y + p2.y) / 2,
          };
        }
        const pinch = pinchRef.current;
        const nextZoom = Math.min(4, Math.max(0.2, pinch.startZoom * (distance / pinch.startDistance)));
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          const midX = (p1.x + p2.x) / 2 - rect.left;
          const midY = (p1.y + p2.y) / 2 - rect.top;
          const startMidX = pinch.startMidX - rect.left;
          const startMidY = pinch.startMidY - rect.top;
          const startWorldX = (startMidX - pinch.startPanX) / pinch.startZoom;
          const startWorldY = (startMidY - pinch.startPanY) / pinch.startZoom;
          const nextPanX = midX - startWorldX * nextZoom;
          const nextPanY = midY - startWorldY * nextZoom;
          setZoom(nextZoom);
          setPan({ x: nextPanX, y: nextPanY });
          transformRef.current.zoom = nextZoom;
          transformRef.current.panX = nextPanX;
          transformRef.current.panY = nextPanY;
          hasDraggedRef.current = true;
        }
        return;
      }
    }

    const tapThreshold = e.pointerType === "mouse" ? 3 : 8;
    if (nodeDragRef.current) {
      const dsx = e.clientX - nodeDragRef.current.startScreenX;
      const dsy = e.clientY - nodeDragRef.current.startScreenY;
      if (Math.abs(dsx) > tapThreshold || Math.abs(dsy) > tapThreshold) hasDraggedRef.current = true;

      const dSimX = dsx / zoom;
      const dSimY = dsy / zoom;
      const node  = simNodesRef.current.find((n) => n.id === nodeDragRef.current!.nodeId);
      if (node) {
        node.x = nodeDragRef.current.startSimX + dSimX;
        node.y = nodeDragRef.current.startSimY + dSimY;
        node.vx = 0; node.vy = 0;
        setDisplayNodes([...simNodesRef.current]);
      }
      return;
    }

    if (bgDragRef.current) {
      const dx = e.clientX - bgDragRef.current.startX;
      const dy = e.clientY - bgDragRef.current.startY;
      if (Math.abs(dx) > tapThreshold || Math.abs(dy) > tapThreshold) hasDraggedRef.current = true;
      setPan({ x: bgDragRef.current.panX + dx, y: bgDragRef.current.panY + dy });
    }
  };

  const onSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "touch") {
      activeTouchPointsRef.current.delete(e.pointerId);
      if (activeTouchPointsRef.current.size < 2) pinchRef.current = null;
    }
    if (!hasDraggedRef.current) {
      if (nodeDragRef.current) {
        // Tap on a node (no drag) → select / expand
        void handleNodeClick(nodeDragRef.current.nodeId);
      } else {
        // Tap on blank canvas → deselect
        setSelectedNodeId(null);
      }
    }
    nodeDragRef.current = null;
    bgDragRef.current   = null;
    if (activeTouchPointsRef.current.size === 0) {
      hasDraggedRef.current = false;
    }
  };

  useEffect(() => {
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      const container = containerRef.current;
      if (!container || !container.contains(e.target as Node)) return;
      e.preventDefault();
      const { zoom: oldZoom, panX: oldPanX, panY: oldPanY } = transformRef.current;
      const factor = Math.exp(-e.deltaY * 0.0025);
      const newZoom = Math.min(4, Math.max(0.2, oldZoom * factor));
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const newPanX = cx - (cx - oldPanX) * (newZoom / oldZoom);
      const newPanY = cy - (cy - oldPanY) * (newZoom / oldZoom);
      transformRef.current.zoom = newZoom;
      transformRef.current.panX = newPanX;
      transformRef.current.panY = newPanY;
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };
    document.addEventListener("wheel", handler, { passive: false });
    return () => document.removeEventListener("wheel", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Loading / empty
  // ---------------------------------------------------------------------------

  if (!allHashtags || !allUsages) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-3 text-center">
          {[80, 110, 68].map((w, i) => (
            <div key={i} className="mx-auto h-[30px] animate-pulse rounded-full bg-app-surface-muted" style={{ width: w }} />
          ))}
        </div>
      </div>
    );
  }

  if (allHashtags.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="text-sm font-medium text-app-ink-faint">No hashtags yet</p>
        <p className="text-xs text-app-ink-faint">
          Type <span className="font-mono">#topic</span> in any note or todo.
        </p>
      </div>
    );
  }

  const SVG_CX = graphSize.width / 2, SVG_CY = graphSize.height / 2;
  const sheetOpen = Boolean(selectedNodeId);
  const sheetTitle = selectedHashtag ? `#${selectedHashtag.name}` : selectedNodeId ? `#${selectedNodeId}` : "Hashtag";

  const renderArtifact = (artifact: HashtagArtifact) => {
    if (artifact.type === "todo") {
      return (
        <CanvasTodoBlock
          todo={artifact.data}
          canvasDateKey={artifact.data.dueDateKey ?? artifact.data.createdDateKey}
          pendingSync={Boolean(artifact.data.pendingSync)}
          onOpenEditor={() => undefined}
          onInlineTitleEdit={() => undefined}
          onToggle={() => undefined}
          onDelete={() => undefined}
          onSelectDate={() => undefined}
        />
      );
    }

    if (artifact.type === "note") {
      return (
        <CanvasNoteBlock
          note={artifact.data}
          pendingSync={Boolean(artifact.data.pendingSync)}
          dispatch={dispatch}
          noteFolders={state.noteFolders}
        />
      );
    }

    if (artifact.type === "bookmark") {
      return (
        <BookmarkCard
          bookmark={artifact.data}
          categoryName={categoryNameById.get(artifact.data.categoryId)}
          surface="canvas"
          pendingSync={Boolean(artifact.data.pendingSync)}
        />
      );
    }

    return <CanvasEventBlock event={artifact.data} pendingSync={Boolean(artifact.data.pendingSync)} dispatch={dispatch} />;
  };

  const renderArtifactList = () => (
    <SuppressHashtagTooltipCtx.Provider value={true}>
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6">
      {selectedArtifacts.length ? (
        <div className="space-y-4">
          {selectedArtifacts.map((artifact) => (
            <div key={artifact.key} className="min-w-0 rounded-xl">
              {renderArtifact(artifact)}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-10 text-sm text-app-ink-faint">No active artifacts use this hashtag.</p>
      )}
    </div>
    </SuppressHashtagTooltipCtx.Provider>
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {showFilter && (
        <div className="absolute left-3 top-3 z-10">
          <HashtagCombobox hashtags={allHashtags} selected={filterHashtags} onChange={setFilterHashtags} />
        </div>
      )}

      {displayNodes.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-sm text-app-ink-faint">No hashtags match your filter.</p>
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="h-full w-full select-none touch-none"
          style={{ cursor: nodeDragRef.current ? "grabbing" : "grab" }}
          onPointerDown={onSvgPointerDown}
          onPointerMove={onSvgPointerMove}
          onPointerUp={onSvgPointerUp}
          onPointerCancel={onSvgPointerUp}

        >
          <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
            <g transform={`translate(${SVG_CX},${SVG_CY})`}>

              {/* ── Co-occurrence edges ────────────────────────────────── */}
              {displayEdges.map((edge, i) => {
                const src = displayNodes[edge.a], tgt = displayNodes[edge.b];
                if (!src || !tgt) return null;
                return (
                  <line key={`e-${i}`}
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    style={{ stroke: "rgb(var(--color-line))" }}
                    strokeWidth={1} strokeLinecap="round"
                  />
                );
              })}

              {/* ── Hashtag chip nodes ─────────────────────────────────── */}
              {displayNodes.map((node) => {
                const _color     = hashtagColor(node.label);
                const color      = { svgBg: isDark ? _color.darkSvgBg : _color.svgBg, svgText: isDark ? _color.darkSvgText : _color.svgText };
                const isSelected = node.id === selectedNodeId;
                const isHovered  = node.id === hoveredNodeId;
                const cw = chipWidth(node.label, node.count);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x},${node.y})`}
                    data-nodeid={node.id}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Inner group: CSS scale transition for hover expand */}
                    <g style={{
                      transform: isHovered ? `scale(1.1)` : `scale(1)`,
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      transition: "transform 0.15s ease",
                    }}>
                      {/* Selection ring */}
                      {isSelected && (
                        <rect
                          x={-(cw + HOVER_PAD) / 2 - 3} y={-(CHIP_H + 4) / 2 - 3}
                          width={cw + HOVER_PAD + 6}     height={CHIP_H + 4 + 6}
                          rx={(CHIP_H + 4) / 2 + 3}
                          fill="none" stroke={color.svgText} strokeWidth={2} opacity={0.4}
                        />
                      )}
                      {/* Chip */}
                      <rect
                        x={-cw / 2} y={-CHIP_H / 2}
                        width={cw} height={CHIP_H}
                        rx={CHIP_H / 2}
                        fill={color.svgBg}
                        stroke={isSelected ? color.svgText : isDark ? "rgba(255,255,255,0.08)" : "white"}
                        strokeWidth={isSelected ? 1.5 : 2}
                      />
                      {/* Label + count */}
                      <text
                        textAnchor="middle" dominantBaseline="middle"
                        fontFamily="system-ui, -apple-system, sans-serif"
                      >
                        <tspan fill={color.svgText} fontSize={FONT_SIZE} fontWeight={600}>#{node.label}</tspan>
                        {node.count > 0 && (
                          <tspan fill={color.svgText} fontSize={10} fontWeight={400} opacity={0.55}> · {node.count}</tspan>
                        )}
                      </text>
                    </g>
                  </g>
                );
              })}

            </g>
          </g>
        </svg>
      )}

      {/* Hint */}
      <p className="pointer-events-none absolute inset-x-0 bottom-3 px-4 text-center text-[11px] text-app-line-strong lg:left-1/2 lg:inset-x-auto lg:px-0 lg:-translate-x-1/2">
        Click a tag · Drag to move · Pinch to zoom · Drag canvas to pan
      </p>

      <aside
        className={cn(
          "absolute inset-y-0 right-0 z-20 hidden w-1/2 min-w-[420px] max-w-[720px] min-h-0 flex-col border-l border-app-line bg-app-surface/95 backdrop-blur-md transform-gpu transition-[transform,opacity] duration-app-drawer ease-app-drawer lg:flex",
          sheetOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0",
        )}
        aria-hidden={!sheetOpen}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-app-line px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-app-ink">{sheetTitle}</p>
            <p className="text-xs text-app-ink-faint">{selectedArtifacts.length} artifacts</p>
          </div>
          <button
            type="button"
            onClick={closeArtifactSheet}
            className="flex h-9 w-9 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted active:scale-[0.98]"
            aria-label="Close hashtag artifacts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {renderArtifactList()}
      </aside>

      <ModalPortal>
        <div
          aria-hidden="true"
          className={cn(
            "fixed inset-0 z-app-overlay bg-app-ink/55 transform-gpu transition-opacity duration-app-drawer ease-app-drawer lg:hidden",
            sheetOpen ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          onPointerDown={closeArtifactSheet}
        />
        <section
          className={cn(
            "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface shadow-app-drawer transform-gpu lg:hidden",
            isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
            sheetOpen ? "translate-y-0" : "pointer-events-none translate-y-full",
          )}
          style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
        >
          <div className="shrink-0 px-4 pt-3 pb-2" {...dragHandleProps}>
            <GripHorizontal className="mx-auto h-5 w-5 text-app-line-strong" />
          </div>
          <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-app-line px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-app-ink">{sheetTitle}</p>
              <p className="text-xs text-app-ink-faint">{selectedArtifacts.length} artifacts</p>
            </div>
            <button
              type="button"
              onClick={closeArtifactSheet}
              className="flex h-9 w-9 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted active:scale-[0.98]"
              aria-label="Close hashtag artifacts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {renderArtifactList()}
        </section>
      </ModalPortal>
    </div>
  );
}
