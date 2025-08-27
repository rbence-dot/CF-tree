import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import FlowChart from './FlowChart';
import GanttChart from './GanttChart';

function App() {
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
          <Route path="/" element={<FlowChart />} />
          <Route path="/gantt" element={<GanttChart />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;