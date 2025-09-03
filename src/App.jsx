import React, { useState } from 'react';
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

  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li><Link to="/">Flow Chart</Link></li>
            <li><Link to="/gantt">Gantt Chart</Link></li>
            <li><Link to="/action-plan">Action Plan</Link></li>
          </ul>
        </nav>
        <hr />
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
