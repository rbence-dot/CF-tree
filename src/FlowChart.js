import React, { useMemo, useRef, useState, useEffect } from "react";

// ──────────────────────────────────────────────────────────────────────────────
//  Saiccor Energy Optimisation – Control Factor Tree · SVG Flow Diagram (Top→Down, Collapsible, Editable Colours)
//  ✅ Zero external dependencies (pure React + SVG)
//  – Top→Down layout (root at top, expands downward)
//  – Pan & zoom (drag / wheel), Export SVG
//  – Click a node to edit its text & colours in the side panel
//  – Click the small ▸/▾ button on category nodes to expand/collapse children
// ──────────────────────────────────────────────────────────────────────────────

// ── IDs
const ROOT_ID = "root";

// ── Base data (from your Control Factor Tree)
const categories = [
  { id: "coal", label: "Coal", category: "Coal" },
  { id: "electricity", label: "Electricity (Steam & Turbines)", category: "Electricity" },
  { id: "recovery", label: "Recovery", category: "Recovery" },
  { id: "efficiency", label: "Energy Efficiency", category: "Energy Efficiency" },
];

const initiatives = [
  // Coal
  { parent: "coal", id: "biomass", label: "Biomass Co‑Firing", category: "Coal", savings: "High", effort: "High" },
  { parent: "coal", id: "aircontrol", label: "Optimise Combustion & O₂ Trim", category: "Coal", savings: "Medium", effort: "Low" },
  { parent: "coal", id: "economiser", label: "Flue Gas Heat Recovery (Economiser/Air Preheater)", category: "Coal", savings: "Medium", effort: "Medium" },
  { parent: "coal", id: "blowdown", label: "Boiler Blowdown Heat Recovery", category: "Coal", savings: "Medium", effort: "Low" },
  { parent: "coal", id: "deaerator", label: "Feedwater & Deaerator Optimisation", category: "Coal", savings: "Medium", effort: "Low" },
  { parent: "coal", id: "loadmgmt", label: "Boiler Load Management & Scheduling", category: "Coal", savings: "Medium", effort: "Low" },
  { parent: "coal", id: "hotwell", label: "Hot‑Well Recovery & Water Reuse", category: "Coal", savings: "Low", effort: "Low" },

  // Electricity
  { parent: "electricity", id: "pressureopt", label: "Steam Pressure Optimisation & Turbine Load", category: "Electricity", savings: "High", effort: "Medium" },
  { parent: "electricity", id: "tgeff", label: "Turbine Efficiency Improvement", category: "Electricity", savings: "High", effort: "High" },
  { parent: "electricity", id: "steamleaks", label: "Minimise Steam Leaks & Losses", category: "Electricity", savings: "Medium", effort: "Low" },
  { parent: "electricity", id: "condrec-steam", label: "Condensate Recovery (Steam System)", category: "Electricity", savings: "Medium", effort: "Medium" },
  { parent: "electricity", id: "insulation", label: "Steam System Insulation & Lagging", category: "Electricity", savings: "Medium", effort: "Low" },

  // Recovery
  { parent: "recovery", id: "blsolids", label: "Maximise Black Liquor Solids & RB Usage", category: "Recovery", savings: "High", effort: "High" },
  { parent: "recovery", id: "mgo", label: "Closed‑Loop Chemical Recovery (MgO)", category: "Recovery", savings: "High", effort: "High" },
  { parent: "recovery", id: "molten-s", label: "Use Molten Sulphur in Acid Plant", category: "Recovery", savings: "Medium", effort: "Medium" },
  { parent: "recovery", id: "hx-upgrades", label: "Process Heat Exchanger Upgrades", category: "Recovery", savings: "Medium", effort: "Medium" },
  { parent: "recovery", id: "condrec-proc", label: "Condensate & Hot Water Recovery (Process)", category: "Recovery", savings: "Medium", effort: "Medium" },

  // Energy Efficiency
  { parent: "efficiency", id: "heatpumps", label: "Replace Electric Heaters with Heat Pumps", category: "Energy Efficiency", savings: "Low", effort: "Low" },
  { parent: "efficiency", id: "vsd", label: "Variable Speed Drives (VSDs) on Motors", category: "Energy Efficiency", savings: "High", effort: "Medium" },
  { parent: "efficiency", id: "turbovac", label: "Efficient Vacuum System (Turbovac)", category: "Energy Efficiency", savings: "Medium", effort: "Medium" },
  { parent: "efficiency", id: "lighting", label: "Lighting & HVAC Efficiency", category: "Energy Efficiency", savings: "Low", effort: "Low" },
  { parent: "efficiency", id: "compressedair", label: "Compressed Air System Optimisation", category: "Energy Efficiency", savings: "Medium", effort: "Low" },
  { parent: "efficiency", id: "training", label: "Process Optimisation & Training", category: "Energy Efficiency", savings: "Medium", effort: "Low" },
];

// ── Defaults
const defaults = {
  bg: {
    Coal: "#FEF3C7",          // amber-100
    Electricity: "#E0F2FE",   // sky-100
    Recovery: "#D1FAE5",      // emerald-100
    "Energy Efficiency": "#FAE8FF", // fuchsia-100
  },
  stroke: "#CBD5E1",
  text: "#0F172A",
  edge: "#94A3B8",
};

// ── Build base nodes map
function buildInitialMap() {
  const map = {};
  map[ROOT_ID] = { id: ROOT_ID, label: "Saiccor Energy Optimisation Program", category: "Energy Efficiency", bg: defaults.bg["Energy Efficiency"], text: defaults.text };
  for (const c of categories) map[c.id] = { ...c, bg: defaults.bg[c.category], text: defaults.text };
  for (const i of initiatives) map[i.id] = { ...i, bg: defaults.bg[i.category], text: defaults.text };
  return map;
}

// ── Layout (Top → Down)
function layoutTopDown(dataMap, collapsedSet, childrenMap) {
  const nodeW = 260;
  const nodeH = 88;
  const hGap = 40; // Horizontal gap between siblings
  const vGap = 80; // Vertical gap between parent and children
  const margin = 24;

  const memo = {}; // Memoization for subtree layouts

  function getSubtreeLayout(nodeId) {
    if (memo[nodeId]) {
      return memo[nodeId];
    }

    const isCollapsed = collapsedSet.has(nodeId);
    const children = (isCollapsed ? [] : childrenMap[nodeId] || []).filter(id => dataMap[id]);
    const childLayouts = children.map(getSubtreeLayout);

    const nodeData = dataMap[nodeId];
    if (!nodeData) {
      return { width: 0, height: 0, nodes: {}, edges: [], rootX: 0 };
    }

    let childrenWidth = 0;
    if (childLayouts.length > 0) {
      childrenWidth = childLayouts.reduce((acc, l) => acc + l.width, 0) + hGap * (childLayouts.length - 1);
    }

    const selfWidth = nodeW;
    const subtreeWidth = Math.max(selfWidth, childrenWidth);
    const rootX = (subtreeWidth - selfWidth) / 2;

    const nodes = { [nodeId]: { x: rootX, y: 0, w: selfWidth, h: nodeH, data: nodeData } };
    const edges = [];

    let maxChildHeight = 0;
    if (childLayouts.length > 0) {
      let childX = (subtreeWidth - childrenWidth) / 2;
      const childY = nodeH + vGap;

      childLayouts.forEach((layout, i) => {
        const childId = children[i];
        const currentChildX = childX;
        // Offset all nodes and edges from the child's subtree
        for (const id in layout.nodes) {
          const n = layout.nodes[id];
          nodes[id] = { ...n, x: n.x + currentChildX, y: n.y + childY };
        }
        for (const edge of layout.edges) {
          edges.push({ ...edge, points: edge.points.map(([x, y]) => [x + currentChildX, y + childY]) });
        }

        // Create edge from parent to child
        const parentCX = rootX + selfWidth / 2;
        const parentCY = nodeH;
        const childRootNode = layout.nodes[childId];
        const childCX = childRootNode.x + currentChildX;
        const childCY = childRootNode.y + childY;

        edges.push({
          type: "elbow",
          points: [
            [parentCX, parentCY],
            [parentCX, childCY - vGap / 2],
            [childCX + selfWidth / 2, childCY - vGap / 2],
            [childCX + selfWidth / 2, childCY],
          ],
        });

        childX += layout.width + hGap;
        maxChildHeight = Math.max(maxChildHeight, layout.height);
      });
    }

    const subtreeHeight = nodeH + (childLayouts.length > 0 ? vGap + maxChildHeight : 0);

    const result = { width: subtreeWidth, height: subtreeHeight, nodes, edges, rootX };
    memo[nodeId] = result;
    return result;
  }

  const finalLayout = getSubtreeLayout(ROOT_ID);

  // --- Define Viewport and Center Content ---
  // First, calculate the actual dimensions of the tree content.
  const contentWidth = finalLayout.width + 2 * margin;
  const contentHeight = finalLayout.height + 2 * margin;

  // To prevent the view from feeling "zoomed in" on small trees, we'll
  // enforce a minimum viewport size. The tree will be centered within this.
  const minVpWidth = 1920; // A reasonable default width for the canvas
  const minVpHeight = 1080; // A reasonable default height for the canvas

  const vpWidth = Math.max(contentWidth, minVpWidth); 
  const vpHeight = Math.max(contentHeight, minVpHeight);

  // Calculate offsets to center the content within the larger viewport.
  const offsetX = (vpWidth - contentWidth) / 2;
  const offsetY = margin; // Use a fixed top margin for consistency

  // Apply the margin and centering offset to all nodes and edges.
  const finalNodes = {};
  for (const id in finalLayout.nodes) {
    const n = finalLayout.nodes[id];
    finalNodes[id] = { ...n, x: n.x + margin + offsetX, y: n.y + margin + offsetY };
  }
  const finalEdges = finalLayout.edges.map(edge => ({
    ...edge,
    points: edge.points.map(([x, y]) => [x + margin + offsetX, y + margin + offsetY]),
  }));

  return {
    nodes: finalNodes,
    edges: finalEdges,
    size: { width: vpWidth, height: vpHeight },
    metrics: { nodeW, nodeH },
  };
}

function Node({ id, x, y, w, h, data, isCollapsible, isCollapsed, onToggle, onSelect, onUpdateData, costLegend }) {
  const { label, category, savings, effort, bg, text } = data;

  const levelOptions = ["Low", "Medium", "High"];

  const levelToKey = { Low: "low", Medium: "medium", High: "high" };
  const savingsKey = levelToKey[savings];
  const effortKey = levelToKey[effort];

  const savingsStyle = savingsKey && costLegend[savingsKey] ? { backgroundColor: costLegend[savingsKey].bg, color: costLegend[savingsKey].text } : {};
  const effortStyle = effortKey && costLegend[effortKey] ? { backgroundColor: costLegend[effortKey].bg, color: costLegend[effortKey].text } : {};

  return (
    <g transform={`translate(${x},${y})`} onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
      {/* Card */}
      <rect x={0} y={0} width={w} height={h} rx={14} ry={14} fill={bg || defaults.bg[category] || "#FFFFFF"} stroke={defaults.stroke} />

      {/* Title & chips */}
      <foreignObject x={12} y={8} width={w - 24} height={h - 16}>
        <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: text || defaults.text, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {isCollapsible && (<button onClick={(e) => { e.stopPropagation(); onToggle(id); }} style={{ fontSize: 11, lineHeight: 1, border: "1px solid #CBD5E1", background: "white", borderRadius: 6, padding: "0 6px" }}>{isCollapsed ? "▸" : "▾"}</button>)}
              <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.15 }}>{label}</div>
            </div>
          </div>
          {/* Editable fields */}
          <div style={{ display: "grid", gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
            <div>
              <label style={{ opacity: 0.7, display: 'block', marginBottom: '2px' }}>Savings</label>
              <select
                value={savings || ""}
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdateData(id, { savings: e.target.value })}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: 600, appearance: 'none', textAlign: 'center', ...savingsStyle }}
              >
                {levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
            <div>
              <label style={{ opacity: 0.7, display: 'block', marginBottom: '2px' }}>Effort</label>
              <select
                value={effort || ""}
                onClick={e => e.stopPropagation()}
                onChange={e => onUpdateData(id, { effort: e.target.value })}
                style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: 600, appearance: 'none', textAlign: 'center', ...effortStyle }}
              >
                {levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            </div>
          </div>
        </div>
      </foreignObject>
    </g>
  );
}

function Edge({ points }) {
  if (!points || points.length < 2) return null;
  const d = points.map((p) => p.join(",")).join(" ");
  return <polyline points={d} fill="none" stroke={defaults.edge} strokeWidth={1.5} markerEnd="url(#arrow)" />;
}

export default function FlowChart() {
  const [dataMap, setDataMap] = useState(buildInitialMap);
  const [collapsed, setCollapsed] = useState(new Set()); // category ids
  const [selected, setSelected] = useState(null); // node id
  const [costLegend, setCostLegend] = useState({
    low: { value: "10,000", bg: "#dbeafe", text: "#1e40af" },
    medium: { value: "50,000", bg: "#ffedd5", text: "#9a3412" },
    high: { value: "100,000", bg: "#fecaca", text: "#991b1b" },
  });
  const [childrenMap, setChildrenMap] = useState(() => {
    const initialChildren = categories.reduce((acc, c) => {
      acc[c.id] = initiatives.filter((i) => i.parent === c.id).map((i) => i.id);
      return acc;
    }, {});
    initialChildren[ROOT_ID] = categories.map((c) => c.id);
    return initialChildren;
  });

  const parentMap = useMemo(() => {
    const map = {};
    for (const parentId in childrenMap) {
      for (const childId of childrenMap[parentId]) {
        map[childId] = parentId;
      }
    }
    return map;
  }, [childrenMap]);
  const { nodes, edges, size } = useMemo(() => layoutTopDown(dataMap, collapsed, childrenMap), [dataMap, collapsed, childrenMap]);
  const svgRef = useRef(null);
  const svgImportInputRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const dragRef = useRef({ dragging: false, x: 0, y: 0, tx0: 0, ty0: 0 });

  useEffect(() => {
    const onWheel = (e) => {
      if (!svgRef.current) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale((s) => Math.max(0.2, Math.min(3, s + delta)));
    };
    const el = svgRef.current;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onMouseDown = (e) => {
    dragRef.current = { dragging: true, x: e.clientX, y: e.clientY, tx0: tx, ty0: ty };
  };
  const onMouseMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setTx(dragRef.current.tx0 + dx);
    setTy(dragRef.current.ty0 + dy);
  };
  const onMouseUp = () => (dragRef.current.dragging = false);

  const fitView = () => { setScale(1); setTx(0); setTy(0); };

  const downloadSVG = async () => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true);

    const stateToSave = {
      dataMap,
      childrenMap,
      collapsed: Array.from(collapsed),
      costLegend,
    };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const scriptEl = document.createElementNS("http://www.w3.org/2000/svg", "script");
    scriptEl.setAttribute("type", "application/json+cftree");
    scriptEl.textContent = jsonString;

    let defsEl = svgClone.querySelector("defs");
    if (!defsEl) {
      defsEl = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      svgClone.prepend(defsEl);
    }
    defsEl.appendChild(scriptEl);

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgClone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });

    // Modern way: File System Access API to allow user to choose save location.
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'saiccor-control-factor-tree.svg',
          types: [{
            description: 'SVG Image',
            accept: { 'image/svg+xml': ['.svg'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        // AbortError means the user cancelled the save dialog.
        if (err.name === 'AbortError') {
          return;
        }
        // For other errors, we can fall back to the old method.
        console.error("Error with showSaveFilePicker, falling back:", err);
      }
    }

    // Fallback for older browsers.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "saiccor-control-factor-tree.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSVG = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const svgString = e.target.result;
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const scriptEl = svgDoc.querySelector('script[type="application/json+cftree"]');
        if (!scriptEl) {
          alert("This SVG file does not contain project data.");
          return;
        }

        const loadedState = JSON.parse(scriptEl.textContent);
        if (loadedState.dataMap && loadedState.childrenMap && loadedState.collapsed && loadedState.costLegend) {
          setDataMap(loadedState.dataMap);
          setChildrenMap(loadedState.childrenMap);
          setCollapsed(new Set(loadedState.collapsed));
          setCostLegend(loadedState.costLegend);
          setSelected(null);
          alert("Project imported successfully!");
        } else {
          alert("Invalid project data in SVG file.");
        }
      } catch (error) {
        console.error("Error importing SVG:", error);
        alert("Failed to import SVG file.");
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleImportClick = () => {
    svgImportInputRef.current.click();
  };

  const toggleCollapse = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateSelected = (patch) => {
    if (!selected) return;
    setDataMap((m) => ({ ...m, [selected]: { ...m[selected], ...patch } }));
  };

  const updateNodeData = (nodeId, patch) => {
    if (!nodeId) return;
    setDataMap((m) => ({ ...m, [nodeId]: { ...m[nodeId], ...patch } }));
  };

  const handleAddChild = () => {
    if (!selected) return;
    const newId = `node_${Date.now()}`;
    const parentNode = dataMap[selected];
    const newNode = {
      id: newId,
      label: "New Initiative",
      category: parentNode.category,
      parent: selected,
      bg: parentNode.bg,
      text: parentNode.text,
    };

    setDataMap((m) => ({ ...m, [newId]: newNode }));
    setChildrenMap((cm) => {
      const next = { ...cm };
      const parentChildren = next[selected] || [];
      next[selected] = [...parentChildren, newId];
      return next;
    });
    setSelected(newId);
  };

  const handleAddSibling = () => {
    if (!selected || selected === ROOT_ID) return;
    const parentId = parentMap[selected];
    if (!parentId) return;

    const newId = `node_${Date.now()}`;
    const siblingNode = dataMap[selected];
    const newNode = { id: newId, label: "New Sibling", category: siblingNode.category, parent: parentId, bg: siblingNode.bg, text: siblingNode.text };

    setDataMap((m) => ({ ...m, [newId]: newNode }));
    setChildrenMap((cm) => {
      const siblings = [...(cm[parentId] || [])];
      const idx = siblings.indexOf(selected);
      siblings.splice(idx + 1, 0, newId);
      return { ...cm, [parentId]: siblings };
    });
    setSelected(newId);
  };

  const handleDelete = () => {
    if (!selected || selected === ROOT_ID) return;

    const nodesToDelete = new Set();
    const q = [selected];
    nodesToDelete.add(selected);

    // Find all descendants using the childrenMap
    while (q.length > 0) {
      const curr = q.shift();
      const children = childrenMap[curr] || [];
      for (const childId of children) {
        if (!nodesToDelete.has(childId)) {
          nodesToDelete.add(childId);
          q.push(childId);
        }
      }
    }

    // Update dataMap: remove all targeted nodes
    setDataMap(currentMap => {
      const nextMap = { ...currentMap };
      nodesToDelete.forEach(id => delete nextMap[id]);
      return nextMap;
    });

    // Update childrenMap: remove from parent and remove entries for deleted nodes
    const parentId = parentMap[selected];
    setChildrenMap(cm => {
      const next = { ...cm };
      if (parentId && next[parentId]) {
        next[parentId] = next[parentId].filter(id => id !== selected);
      }
      nodesToDelete.forEach(id => delete next[id]);
      return next;
    });

    setSelected(null);
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-100">
      <input
        type="file"
        ref={svgImportInputRef}
        onChange={handleImportSVG}
        style={{ display: "none" }}
        accept=".svg"
      />
      {/* Top: Inspector */}
      <div className="border-b-2 border-gray-200 bg-white p-3 z-10 overflow-x-auto">
        <div className="flex flex-nowrap items-center gap-x-4 text-sm">

          {/* Panel 1: Inspector (Actions) */}
          <div className="flex items-center gap-x-3 p-2 border rounded-lg bg-gray-50/50">
            <strong className="shrink-0">Inspector</strong>
            {!selected && (
              <div className="opacity-60 whitespace-nowrap px-2">Select a node</div>
            )}
            {selected && (
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 rounded-md border text-center bg-blue-50 hover:bg-blue-100" onClick={handleAddChild}>
                  Add Child
                </button>
                {selected !== ROOT_ID && (
                  <button className="px-3 py-1.5 rounded-md border text-center bg-gray-100 hover:bg-gray-200" onClick={handleAddSibling}>
                    Sibling
                  </button>
                )}
                {(childrenMap[selected] || []).length > 0 && (
                  <button className="px-3 py-1.5 rounded-md border" onClick={() => toggleCollapse(selected)}>
                    {collapsed.has(selected) ? "Expand" : "Collapse"}
                  </button>
                )}
                {selected !== ROOT_ID && (
                  <button className="px-3 py-1.5 rounded-md border text-center bg-red-50 hover:bg-red-100 text-red-700" onClick={handleDelete}>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Panel 2: Title */}
          {selected && (
            <div className="flex items-center gap-x-2 p-2 border rounded-lg bg-gray-50/50">
              <label className="opacity-70">Title</label>
              <input className="w-48 border rounded-md px-2 py-1" value={dataMap[selected]?.label || ""} onChange={(e) => updateSelected({ label: e.target.value })} />
            </div>
          )}

          {/* Panel 3: Colors */}
          {selected && (
            <div className="flex items-center gap-x-4 p-2 border rounded-lg bg-gray-50/50">
              <div className="flex items-center gap-2">
                <label className="opacity-70">Background</label>
                <input type="color" className="w-8 h-8 p-0.5 border rounded-md" value={dataMap[selected]?.bg || "#ffffff"} onChange={(e) => updateSelected({ bg: e.target.value })} />
              </div>
              <div className="flex items-center gap-2">
                <label className="opacity-70">Text</label>
                <input type="color" className="w-8 h-8 p-0.5 border rounded-md" value={dataMap[selected]?.text || "#0F172A"} onChange={(e) => updateSelected({ text: e.target.value })} />
              </div>
            </div>
          )}

          {/* Panel 4: Cost Legend */}
          <div className="flex items-center gap-x-3 p-2 border rounded-lg bg-gray-50/50">
            <strong className="shrink-0">Cost Legend</strong>
            <div className="flex items-center gap-x-4">
              <div className="flex items-center gap-2">
                <label htmlFor="cost-low" className="font-medium" style={{ color: costLegend.low.text }}>Low</label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">R</span>
                  <input id="cost-low" type="text" value={costLegend.low.value} onChange={e => setCostLegend(c => ({ ...c, low: { ...c.low, value: e.target.value } }))} className="w-24 border rounded-md px-2 py-1" />
                  <input type="color" value={costLegend.low.bg} onChange={e => setCostLegend(c => ({ ...c, low: { ...c.low, bg: e.target.value } }))} className="w-8 h-8 ml-2 p-0.5 border rounded-md" title="Background color" />
                  <input type="color" value={costLegend.low.text} onChange={e => setCostLegend(c => ({ ...c, low: { ...c.low, text: e.target.value } }))} className="w-8 h-8 ml-1 p-0.5 border rounded-md" title="Text color" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="cost-medium" className="font-medium" style={{ color: costLegend.medium.text }}>Medium</label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">R</span>
                  <input id="cost-medium" type="text" value={costLegend.medium.value} onChange={e => setCostLegend(c => ({ ...c, medium: { ...c.medium, value: e.target.value } }))} className="w-24 border rounded-md px-2 py-1" />
                  <input type="color" value={costLegend.medium.bg} onChange={e => setCostLegend(c => ({ ...c, medium: { ...c.medium, bg: e.target.value } }))} className="w-8 h-8 ml-2 p-0.5 border rounded-md" title="Background color" />
                  <input type="color" value={costLegend.medium.text} onChange={e => setCostLegend(c => ({ ...c, medium: { ...c.medium, text: e.target.value } }))} className="w-8 h-8 ml-1 p-0.5 border rounded-md" title="Text color" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="cost-high" className="font-medium" style={{ color: costLegend.high.text }}>High</label>
                <div className="flex items-center">
                  <span className="text-gray-500 mr-1">R</span>
                  <input id="cost-high" type="text" value={costLegend.high.value} onChange={e => setCostLegend(c => ({ ...c, high: { ...c.high, value: e.target.value } }))} className="w-24 border rounded-md px-2 py-1" />
                  <input type="color" value={costLegend.high.bg} onChange={e => setCostLegend(c => ({ ...c, high: { ...c.high, bg: e.target.value } }))} className="w-8 h-8 ml-2 p-0.5 border rounded-md" title="Background color" />
                  <input type="color" value={costLegend.high.text} onChange={e => setCostLegend(c => ({ ...c, high: { ...c.high, text: e.target.value } }))} className="w-8 h-8 ml-1 p-0.5 border rounded-md" title="Text color" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex-grow"></div>

          {/* Panel 5: Diagram Toolbar */}
          <div className="flex items-center gap-x-4">
            <div className="font-semibold whitespace-nowrap">Control Factor Tree – Flow Diagram</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 rounded-xl border" onClick={() => setScale((s) => Math.min(3, s + 0.1))}>Zoom +</button>
              <button className="px-3 py-1.5 rounded-xl border" onClick={() => setScale((s) => Math.max(0.2, s - 0.1))}>Zoom −</button>
              <button className="px-3 py-1.5 rounded-xl border" onClick={fitView}>Fit</button>
              <button className="px-3 py-1.5 rounded-xl border" onClick={handleImportClick}>Import SVG</button>
              <button className="px-3 py-1.5 rounded-xl border" onClick={downloadSVG}>Export SVG</button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Diagram */}
      <div className="flex-1 bg-white" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} style={{ cursor: "grab", userSelect: "none" }} onMouseDown={onMouseDown}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={defaults.edge} />
            </marker>
          </defs>

          <g transform={`translate(${tx},${ty}) scale(${scale})`}>
            {/* edges */}
            {edges.map((e, idx) => (
              <Edge key={idx} points={e.points} />
            ))}

            {/* nodes */}
            {Object.entries(nodes).map(([id, n]) => (
              <Node
                key={id}
                id={id}
                x={n.x}
                y={n.y}
                w={n.w}
                h={n.h}
                data={{ id, ...n.data }}
                isCollapsible={(childrenMap[id] || []).length > 0}
                isCollapsed={collapsed.has(id)}
                onToggle={toggleCollapse}
                onSelect={setSelected}
                onUpdateData={updateNodeData}
                costLegend={costLegend}
              />
            ))}
          </g>
          </svg>
        </div>
      </div>
  );
}
