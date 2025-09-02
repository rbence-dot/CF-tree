import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import FlowChart from './FlowChart';
import GanttChart from './GanttChart';
import { buildInitialMap, getInitiatives, getCategories, ROOT_ID } from './FlowChart';

function App() {
  const [dataMap, setDataMap] = useState(buildInitialMap());
  const [collapsed, setCollapsed] = useState(new Set(getCategories().map(c => c.id)));
  const [costLegend, setCostLegend] = useState({
    low: { value: "10,000", bg: "#dbeafe", text: "#1e40af" },
    medium: { value: "50,000", bg: "#ffedd5", text: "#9a3412" },
    high: { value: "100,000", bg: "#fecaca", text: "#991b1b" },
  });
  const [childrenMap, setChildrenMap] = useState(() => {
    const initialChildren = getCategories().reduce((acc, c) => {
      acc[c.id] = getInitiatives()
        .filter((i) => i.parent === c.id)
        .map((i) => i.id);
      return acc;
    }, {});
    initialChildren[ROOT_ID] = getCategories().map((c) => c.id);
    return initialChildren;
  });

  return (
    <Router>
      <div>
        <nav>
          <ul>
            <li>
              <Link to="/">Flow Chart</Link>
            </li>
            <li>
              <Link to="/gantt">Gantt Chart</Link>
            </li>
          </ul>
        </nav>

        <hr />

        <Routes>
          <Route
            path="/"
            element={
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
            }
          />
          <Route path="/gantt" element={<GanttChart dataMap={dataMap} setDataMap={setDataMap} childrenMap={childrenMap} setChildrenMap={setChildrenMap} collapsed={collapsed} setCollapsed={setCollapsed} costLegend={costLegend} setCostLegend={setCostLegend} />} />
        </Routes>
      </div>
    </Router>
  );
}


export default App;