import React, { useMemo, useRef, useState, useEffect } from "react";

export const ROOT_ID = "root";

const categories = [
	{ id: "coal", label: "Coal", category: "Coal" },
	{ id: "electricity", label: "Electricity (Steam & Turbines)", category: "Electricity" },
	{ id: "recovery", label: "Recovery", category: "Recovery" },
	{ id: "efficiency", label: "Energy Efficiency", category: "Energy Efficiency" },
];

const initiatives = [
	{ parent: "coal", id: "biomass", label: "Biomass Co‑Firing", category: "Coal", savings: "High", effort: "High" },
	{ parent: "coal", id: "aircontrol", label: "Optimise Combustion & O₂ Trim", category: "Coal", savings: "Medium", effort: "Low" },
	{ parent: "coal", id: "economiser", label: "Flue Gas Heat Recovery (Economiser/Air Preheater)", category: "Coal", savings: "Medium", effort: "Medium" },
	{ parent: "coal", id: "blowdown", label: "Boiler Blowdown Heat Recovery", category: "Coal", savings: "Medium", effort: "Low" },
	{ parent: "coal", id: "deaerator", label: "Feedwater & Deaerator Optimisation", category: "Coal", savings: "Medium", effort: "Low" },
	{ parent: "coal", id: "loadmgmt", label: "Boiler Load Management & Scheduling", category: "Coal", savings: "Medium", effort: "Low" },
	{ parent: "coal", id: "hotwell", label: "Hot‑Well Recovery & Water Reuse", category: "Coal", savings: "Low", effort: "Low" },
	{ parent: "electricity", id: "pressureopt", label: "Steam Pressure Optimisation & Turbine Load", category: "Electricity", savings: "High", effort: "Medium" },
	{ parent: "electricity", id: "tgeff", label: "Turbine Efficiency Improvement", category: "Electricity", savings: "High", effort: "High" },
	{ parent: "electricity", id: "steamleaks", label: "Minimise Steam Leaks & Losses", category: "Electricity", savings: "Medium", effort: "Low" },
	{ parent: "electricity", id: "condrec-steam", label: "Condensate Recovery (Steam System)", category: "Electricity", savings: "Medium", effort: "Medium" },
	{ parent: "electricity", id: "insulation", label: "Steam System Insulation & Lagging", category: "Electricity", savings: "Medium", effort: "Low" },
	{ parent: "recovery", id: "blsolids", label: "Maximise Black Liquor Solids & RB Usage", category: "Recovery", savings: "High", effort: "High" },
	{ parent: "recovery", id: "mgo", label: "Closed‑Loop Chemical Recovery (MgO)", category: "Recovery", savings: "High", effort: "High" },
	{ parent: "recovery", id: "molten-s", label: "Use Molten Sulphur in Acid Plant", category: "Recovery", savings: "Medium", effort: "Medium" },
	{ parent: "recovery", id: "hx-upgrades", label: "Process Heat Exchanger Upgrades", category: "Recovery", savings: "Medium", effort: "Medium" },
	{ parent: "recovery", id: "condrec-proc", label: "Condensate & Hot Water Recovery (Process)", category: "Recovery", savings: "Medium", effort: "Medium" },
	{ parent: "efficiency", id: "heatpumps", label: "Replace Electric Heaters with Heat Pumps", category: "Energy Efficiency", savings: "Low", effort: "Low" },
	{ parent: "efficiency", id: "vsd", label: "Variable Speed Drives (VSDs) on Motors", category: "Energy Efficiency", savings: "High", effort: "Medium" },
	{ parent: "efficiency", id: "turbovac", label: "Efficient Vacuum System (Turbovac)", category: "Energy Efficiency", savings: "Medium", effort: "Medium" },
	{ parent: "efficiency", id: "lighting", label: "Lighting & HVAC Efficiency", category: "Energy Efficiency", savings: "Low", effort: "Low" },
	{ parent: "efficiency", id: "compressedair", label: "Compressed Air System Optimisation", category: "Energy Efficiency", savings: "Medium", effort: "Low" },
	{ parent: "efficiency", id: "training", label: "Process Optimisation & Training", category: "Energy Efficiency", savings: "Medium", effort: "Low" },
];

export const getInitiatives = () => initiatives;
export const getCategories = () => categories;

const defaults = {
	bg: {
		Coal: "#FEF3C7",
		Electricity: "#E0F2FE",
		Recovery: "#D1FAE5",
		"Energy Efficiency": "#FAE8FF",
	},
	stroke: "#CBD5E1",
	text: "#0F172A",
	edge: "#94A3B8",
};

export function buildInitialMap() {
	const map = {};
	map[ROOT_ID] = { id: ROOT_ID, label: "Saiccor Energy Optimisation Program", category: "Energy Efficiency", bg: defaults.bg["Energy Efficiency"], text: defaults.text };
	for (const c of categories) map[c.id] = { ...c, bg: defaults.bg[c.category], text: defaults.text };
	for (const i of initiatives) map[i.id] = { ...i, bg: defaults.bg[i.category], text: defaults.text };
	return map;
}

function layoutTopDown(dataMap, collapsedSet, childrenMap) {
	const nodeW = 260;
	const nodeH = 88;
	const hGap = 40;
	const vGap = 80;
	const margin = 24;
	const memo = {};
	function getSubtreeLayout(nodeId) {
		if (memo[nodeId]) return memo[nodeId];
		const isCollapsed = collapsedSet.has(nodeId);
		const children = (isCollapsed ? [] : childrenMap[nodeId] || []).filter(id => dataMap[id]);
		const childLayouts = children.map(getSubtreeLayout);
		const nodeData = dataMap[nodeId];
		if (!nodeData) return { width: 0, height: 0, nodes: {}, edges: [], rootX: 0 };
		let childrenWidth = 0;
		if (childLayouts.length > 0) childrenWidth = childLayouts.reduce((acc, l) => acc + l.width, 0) + hGap * (childLayouts.length - 1);
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
				for (const id in layout.nodes) {
					const n = layout.nodes[id];
					nodes[id] = { ...n, x: n.x + currentChildX, y: n.y + childY };
				}
				for (const edge of layout.edges) {
					edges.push({ ...edge, points: edge.points.map(([x, y]) => [x + currentChildX, y + childY]) });
				}
				const parentCX = rootX + selfWidth / 2;
				const parentCY = nodeH;
				const childRootNode = layout.nodes[childId];
				const childCX = childRootNode.x + currentChildX;
				const childCY = childRootNode.y + childY;
				edges.push({
					type: "elbow",
					source: nodeId,
						target: childId,
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
	const contentWidth = finalLayout.width + 48;
	const contentHeight = finalLayout.height + 48;
	const minVpWidth = 1920;
	const minVpHeight = 1080;
	const vpWidth = Math.max(contentWidth, minVpWidth);
	const vpHeight = Math.max(contentHeight, minVpHeight);
	const offsetX = (vpWidth - contentWidth) / 2;
	const offsetY = 24;
	const finalNodes = {};
	for (const id in finalLayout.nodes) {
		const n = finalLayout.nodes[id];
		finalNodes[id] = { ...n, x: n.x + 24 + offsetX, y: n.y + 24 + offsetY };
	}
	const finalEdges = finalLayout.edges
		.filter(edge => edge.source && edge.target && finalNodes[edge.source] && finalNodes[edge.target] && Array.isArray(childrenMap[edge.source]) && childrenMap[edge.source].includes(edge.target))
		.map(edge => ({ ...edge, points: edge.points.map(([x, y]) => [x + 24 + offsetX, y + 24 + offsetY]) }));
	return { nodes: finalNodes, edges: finalEdges, size: { width: vpWidth, height: vpHeight }, metrics: { nodeW, nodeH } };
}

function Node({ id, x, y, w, h, data, isCollapsible, isCollapsed, onToggle, onSelect, onUpdateData, costLegend, selected }) {
	const { label, category, savings, effort, bg, text } = data;
	const levelOptions = ["Low", "Medium", "High"];
	const levelToKey = { Low: "low", Medium: "medium", High: "high" };
	const savingsKey = levelToKey[savings];
	const effortKey = levelToKey[effort];
	const savingsStyle = savingsKey && costLegend[savingsKey] ? { backgroundColor: costLegend[savingsKey].bg, color: costLegend[savingsKey].text } : {};
	const effortStyle = effortKey && costLegend[effortKey] ? { backgroundColor: costLegend[effortKey].bg, color: costLegend[effortKey].text } : {};
	return (
		<g transform={`translate(${x},${y})`} onClick={() => onSelect(id)} style={{ cursor: "pointer" }}>
			<rect x={0} y={0} width={w} height={h} rx={14} ry={14} fill={bg || defaults.bg[category] || "#FFFFFF"} stroke={selected ? '#3B82F6' : defaults.stroke} strokeWidth={selected ? 3 : 1} />
			<foreignObject x={12} y={8} width={w - 24} height={h - 16}>
				<div style={{ fontFamily: "Inter, system-ui, sans-serif", color: text || defaults.text, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
							{isCollapsible && (<button onClick={(e) => { e.stopPropagation(); onToggle(id); }} style={{ fontSize: 11, lineHeight: 1, border: "1px solid #CBD5E1", background: "white", borderRadius: 6, padding: "0 6px" }}>{isCollapsed ? "▸" : "▾"}</button>)}
							<div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.15 }}>{label}</div>
						</div>
					</div>
					<div style={{ display: "grid", gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 10 }}>
						<div>
							<label style={{ opacity: 0.7, display: 'block', marginBottom: '2px' }}>Savings</label>
							<select value={savings || ""} onClick={e => e.stopPropagation()} onChange={e => onUpdateData(id, { savings: e.target.value })} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: 600, appearance: 'none', textAlign: 'center', ...savingsStyle }}>
								{levelOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
							</select>
						</div>
						<div>
							<label style={{ opacity: 0.7, display: 'block', marginBottom: '2px' }}>Effort</label>
							<select value={effort || ""} onClick={e => e.stopPropagation()} onChange={e => onUpdateData(id, { effort: e.target.value })} style={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: 4, padding: '2px 4px', fontSize: 11, fontWeight: 600, appearance: 'none', textAlign: 'center', ...effortStyle }}>
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

export default function FlowChart({ dataMap, setDataMap, collapsed, setCollapsed, costLegend, setCostLegend, childrenMap, setChildrenMap }) {
	// Inject fallback styles once (mirrors Tailwind look if utilities missing)
	useEffect(() => {
		if (document.getElementById('fc-styles')) return;
		const style = document.createElement('style');
		style.id = 'fc-styles';
		style.textContent = `
			.fc-wrapper { display:flex; flex-direction:column; width:100%; height:100%; background:#f1f5f9; font:14px/1.3 system-ui,Segoe UI,Roboto,Arial,sans-serif; }
			.fc-toolbar { border-bottom:2px solid #e2e8f0; background:#ffffff; padding:10px 14px; display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
			.fc-toolbar-group { display:flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid #e2e8f0; border-radius:10px; background:#f8fafc; }
			.fc-btn { padding:6px 12px; border:1px solid #cbd5e1; background:#ffffff; border-radius:10px; cursor:pointer; font-size:13px; }
			.fc-btn:hover { background:#f1f5f9; }
			.fc-svg-pane { flex:1; background:#ffffff; }
			.fc-badge-strong { font-weight:600; }
			.fc-input { border:1px solid #cbd5e1; padding:4px 8px; border-radius:6px; font:inherit; }
		`;
		document.head.appendChild(style);
	}, []);
	const [selected, setSelected] = useState(null);
	const derivedChildrenMap = useMemo(() => {
		const cm = {};
		for (const id in dataMap) {
			const node = dataMap[id];
			if (node.parent) {
				cm[node.parent] = cm[node.parent] || [];
				cm[node.parent].push(id);
			}
		}
		return cm;
	}, [dataMap]);
	const parentMap = useMemo(() => {
		const map = {};
		for (const parentId in childrenMap) {
			for (const childId of childrenMap[parentId]) map[childId] = parentId;
		}
		return map;
	}, [childrenMap]);
	const { nodes, edges, size } = useMemo(() => layoutTopDown(dataMap, collapsed, derivedChildrenMap), [dataMap, collapsed, derivedChildrenMap]);
	const svgRef = useRef(null);
	const svgImportInputRef = useRef(null);
	const [scale, setScale] = useState(1);
	const [tx, setTx] = useState(0);
	const [ty, setTy] = useState(0);
	const dragRef = useRef({ dragging: false, x: 0, y: 0, tx0: 0, ty0: 0 });
	useEffect(() => {
		const onWheel = (e) => { if (!svgRef.current) return; e.preventDefault(); const delta = e.deltaY > 0 ? -0.1 : 0.1; setScale((s) => Math.max(0.2, Math.min(3, s + delta))); };
		const el = svgRef.current; el.addEventListener("wheel", onWheel, { passive: false }); return () => el.removeEventListener("wheel", onWheel);
	}, []);
	const onMouseDown = (e) => { dragRef.current = { dragging: true, x: e.clientX, y: e.clientY, tx0: tx, ty0: ty }; };
	const onMouseMove = (e) => { if (!dragRef.current.dragging) return; const dx = e.clientX - dragRef.current.x; const dy = e.clientY - dragRef.current.y; setTx(dragRef.current.tx0 + dx); setTy(dragRef.current.ty0 + dy); };
	const onMouseUp = () => (dragRef.current.dragging = false);
	const fitView = () => { setScale(1); setTx(0); setTy(0); };
	const toggleCollapse = (id) => setCollapsed((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
	const updateSelected = (patch) => { if (!selected) return; setDataMap((m) => ({ ...m, [selected]: { ...m[selected], ...patch } })); };
	const updateNodeData = (nodeId, patch) => { if (!nodeId) return; setDataMap((m) => ({ ...m, [nodeId]: { ...m[nodeId], ...patch } })); };
	const handleAddChild = () => { if (!selected) return; const newId = `node_${Date.now()}`; const parentNode = dataMap[selected]; const newNode = { id: newId, label: "New Initiative", category: parentNode.category, parent: selected, bg: parentNode.bg, text: parentNode.text }; setDataMap((m) => ({ ...m, [newId]: newNode })); setChildrenMap((cm) => { const next = { ...cm }; const parentChildren = next[selected] || []; next[selected] = [...parentChildren, newId]; if (!next[newId]) next[newId] = []; return next; }); setSelected(newId); };
	const handleAddSibling = () => { if (!selected || selected === ROOT_ID) return; const parentId = parentMap[selected]; if (!parentId) return; const newId = `node_${Date.now()}`; const siblingNode = dataMap[selected]; const newNode = { id: newId, label: "New Sibling", category: siblingNode.category, parent: parentId, bg: siblingNode.bg, text: siblingNode.text }; setDataMap((m) => ({ ...m, [newId]: newNode })); setChildrenMap((cm) => { const siblings = [...(cm[parentId] || [])]; const idx = siblings.indexOf(selected); siblings.splice(idx + 1, 0, newId); const next = { ...cm, [parentId]: siblings }; if (!next[newId]) next[newId] = []; return next; }); setSelected(newId); };
	const handleDelete = () => { if (!selected || selected === ROOT_ID) return; const nodesToDelete = new Set([selected]); const q = [selected]; while (q.length) { const curr = q.shift(); const ch = childrenMap[curr] || []; for (const childId of ch) if (!nodesToDelete.has(childId)) { nodesToDelete.add(childId); q.push(childId); } } setDataMap(curr => { const next = { ...curr }; nodesToDelete.forEach(id => delete next[id]); return next; }); setChildrenMap(cm => { const next = { ...cm }; const parentId = parentMap[selected]; if (parentId && next[parentId]) next[parentId] = next[parentId].filter(id => id !== selected); nodesToDelete.forEach(id => delete next[id]); return next; }); setSelected(null); };
	const downloadSVG = async () => { const svgEl = svgRef.current; if (!svgEl) return; const svgClone = svgEl.cloneNode(true); const stateToSave = { dataMap, childrenMap, collapsed: Array.from(collapsed), costLegend }; const jsonString = JSON.stringify(stateToSave, null, 2); const scriptEl = document.createElementNS("http://www.w3.org/2000/svg", "script"); scriptEl.setAttribute("type", "application/json+cftree"); scriptEl.textContent = jsonString; let defsEl = svgClone.querySelector("defs"); if (!defsEl) { defsEl = document.createElementNS("http://www.w3.org/2000/svg", "defs"); svgClone.prepend(defsEl); } defsEl.appendChild(scriptEl); const serializer = new XMLSerializer(); const source = serializer.serializeToString(svgClone); const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" }); if (window.showSaveFilePicker) { try { const handle = await window.showSaveFilePicker({ suggestedName: 'saiccor-control-factor-tree.svg', types: [{ description: 'SVG Image', accept: { 'image/svg+xml': ['.svg'] }, }], }); const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return; } catch (err) { if (err.name === 'AbortError') return; console.error("Error with showSaveFilePicker, falling back:", err); } } const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "saiccor-control-factor-tree.svg"; a.click(); URL.revokeObjectURL(url); };
	const handleImportSVG = (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const svgString = e.target.result; const parser = new DOMParser(); const svgDoc = parser.parseFromString(svgString, "image/svg+xml"); const scriptEl = svgDoc.querySelector('script[type="application/json+cftree"]'); if (!scriptEl) { alert("This SVG file does not contain project data."); return; } const loadedState = JSON.parse(scriptEl.textContent); if (loadedState.dataMap && loadedState.childrenMap && loadedState.collapsed && loadedState.costLegend) { setDataMap(loadedState.dataMap); setChildrenMap(loadedState.childrenMap); setCollapsed(new Set(loadedState.collapsed)); setCostLegend(loadedState.costLegend); setSelected(null); alert("Project imported successfully!"); } else { alert("Invalid project data in SVG file."); } } catch (error) { console.error("Error importing SVG:", error); alert("Failed to import SVG file."); } }; reader.readAsText(file); event.target.value = null; };
	const handleImportClick = () => svgImportInputRef.current.click();

	return (
		<div className="fc-wrapper">
			<input type="file" ref={svgImportInputRef} onChange={handleImportSVG} style={{ display: "none" }} accept=".svg" />
			<div className="fc-toolbar" style={{ overflowX: 'auto' }}>
				<div className="fc-toolbar-group">
					<strong className="fc-badge-strong">Inspector</strong>
					{!selected && <div style={{ opacity: .6, whiteSpace: 'nowrap', padding: '0 4px' }}>Select a node</div>}
					{selected && (
						<div style={{ display: 'flex', gap: 6 }}>
							<button className="fc-btn" onClick={handleAddChild}>Add Child</button>
							{selected !== ROOT_ID && <button className="fc-btn" onClick={handleAddSibling}>Sibling</button>}
							{(childrenMap[selected] || []).length > 0 && <button className="fc-btn" onClick={() => toggleCollapse(selected)}>{collapsed.has(selected) ? "Expand" : "Collapse"}</button>}
							{selected !== ROOT_ID && <button className="fc-btn" style={{ background: '#fef2f2', color: '#b91c1c' }} onClick={handleDelete}>Delete</button>}
						</div>
					)}
				</div>
				{selected && (
					<div className="fc-toolbar-group">
						<label style={{ opacity: .7 }}>Title</label>
						<input className="fc-input" style={{ width: 192 }} value={dataMap[selected]?.label || ""} onChange={(e) => updateSelected({ label: e.target.value })} />
					</div>
				)}
				{selected && (
					<div className="fc-toolbar-group" style={{ gap: 4 }}>
						<label style={{ opacity: .7, whiteSpace: 'nowrap' }}>Color</label>
						{['#FEF3C7','#E0F2FE','#D1FAE5','#FAE8FF','#FEE2E2','#E2E8F0','#DCFCE7','#E0E7FF','#F1F5F9'].map(c => (
							<button key={c} onClick={() => updateSelected({ bg: c })} style={{ width: 24, height: 24, borderRadius: 6, border: dataMap[selected]?.bg === c ? '2px solid #2563EB' : '1px solid #94A3B8', background: c, cursor: 'pointer', padding: 0 }} title={c} />
						))}
					</div>
				)}
				<div style={{ flexGrow: 1 }} />
				<div className="fc-toolbar-group" style={{ gap: 12 }}>
					<div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>Control Factor Tree – Flow Diagram</div>
					<button className="fc-btn" onClick={() => setScale((s) => Math.min(3, s + 0.1))}>Zoom +</button>
					<button className="fc-btn" onClick={() => setScale((s) => Math.max(0.2, s - 0.1))}>Zoom −</button>
					<button className="fc-btn" onClick={fitView}>Fit</button>
					<button className="fc-btn" onClick={handleImportClick}>Import SVG</button>
					<button className="fc-btn" onClick={downloadSVG}>Export SVG</button>
				</div>
			</div>
			<div className="fc-svg-pane" onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
				<svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${size.width} ${size.height}`} style={{ cursor: "grab", userSelect: "none" }} onMouseDown={onMouseDown}>
					<defs>
						<marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
							<path d="M 0 0 L 10 5 L 0 10 z" fill={defaults.edge} />
						</marker>
					</defs>
					<g transform={`translate(${tx},${ty}) scale(${scale})`}>
						{edges.map((e, idx) => <Edge key={idx} points={e.points} />)}
						{Object.entries(nodes).map(([id, n]) => (
							<Node key={id} id={id} x={n.x} y={n.y} w={n.w} h={n.h} data={{ id, ...n.data }} isCollapsible={(derivedChildrenMap[id] || []).length > 0} isCollapsed={collapsed.has(id)} onToggle={toggleCollapse} onSelect={setSelected} onUpdateData={updateNodeData} costLegend={costLegend} selected={selected === id} />
						))}
					</g>
				</svg>
			</div>
		</div>
	);

}
