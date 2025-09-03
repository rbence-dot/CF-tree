import React, { useState, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import FlowChart, { buildInitialMap, ROOT_ID } from './FlowChart.jsx';
import GanttChart from './GanttChart.jsx';
import ActionPlan from './ActionPlan.jsx';

function App() {
  const initialRootMap = buildInitialMap();
  const [dataMap, setDataMap] = useState({ [ROOT_ID]: initialRootMap[ROOT_ID] });
  const [collapsed, setCollapsed] = useState(new Set());
  const [costLegend, setCostLegend] = useState({
    low: { value: "10,000", bg: "#dbeafe", text: "#1e40af" },
    medium: { value: "50,000", bg: "#ffedd5", text: "#9a3412" },
    high: { value: "100,000", bg: "#fecaca", text: "#991b1b" },
  });
  const [childrenMap, setChildrenMap] = useState({ [ROOT_ID]: [] });
  const loadInputRef = useRef(null);

  const handleGlobalSave = async () => {
    const stateToSave = { dataMap, childrenMap, collapsed: Array.from(collapsed), costLegend };
    const jsonString = JSON.stringify(stateToSave, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'project-state.json',
          types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // user cancelled
        console.warn('showSaveFilePicker not available / failed, falling back to download link', err);
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project-state.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGlobalLoadClick = () => {
    if (loadInputRef.current) loadInputRef.current.click();
  };

  const handleGlobalFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const loaded = JSON.parse(ev.target.result);
        if (loaded.dataMap && loaded.childrenMap && loaded.collapsed && loaded.costLegend) {
          setDataMap(loaded.dataMap);
          setChildrenMap(loaded.childrenMap);
          setCollapsed(new Set(loaded.collapsed));
          setCostLegend(loaded.costLegend);
        } else {
          alert('Invalid project file');
        }
      } catch (err) {
        console.error('Failed to parse project file', err);
        alert('Failed to load project file');
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  return (
    <Router>
      <div>
        <input type="file" ref={loadInputRef} onChange={handleGlobalFileChange} style={{ display: 'none' }} accept=".json" />
        <nav style={{ display:'flex', alignItems:'center', gap:16, padding:'10px 14px', background:'#fff', borderBottom:'2px solid #e2e8f0', flexWrap:'wrap' }}>
          <div style={{ display:'flex', gap:12, fontWeight:600 }}>
            <Link to="/">Flow</Link>
            <Link to="/gantt">Gantt</Link>
            <Link to="/action-plan">Action Plan</Link>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={handleGlobalSave} style={{ padding:'6px 12px', border:'1px solid #cbd5e1', background:'#f8fafc', borderRadius:8, cursor:'pointer' }}>Save</button>
            <button onClick={handleGlobalLoadClick} style={{ padding:'6px 12px', border:'1px solid #cbd5e1', background:'#f8fafc', borderRadius:8, cursor:'pointer' }}>Load</button>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={
            <FlowChart
              dataMap={dataMap}
              setDataMap={setDataMap}
              collapsed={collapsed}
              setCollapsed={setCollapsed}
              costLegend={costLegend}
              setCostLegend={setCostLegend}
              childrenMap={childrenMap}
              setChildrenMap={setChildrenMap}
            />
          } />
          <Route path="/gantt" element={<GanttChart dataMap={dataMap} setDataMap={setDataMap} childrenMap={childrenMap} setChildrenMap={setChildrenMap} collapsed={collapsed} setCollapsed={setCollapsed} costLegend={costLegend} setCostLegend={setCostLegend} />} />
          <Route path="/action-plan" element={<ActionPlan dataMap={dataMap} setDataMap={setDataMap} childrenMap={childrenMap} collapsed={collapsed} setCollapsed={setCollapsed} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
