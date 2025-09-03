// Clean single-definition component
import React, { useState, useEffect, useCallback, useRef } from 'react';

// Column definitions (index aligned with headers)
// Editable excludes index + status
const COLS = [
  { key: 'index', title: '#', width: 70, editable: false, sticky: true },
  { key: 'label', title: 'Assigned Task', width: 260, editable: true },
  { key: 'keyQuestion', title: 'Key Question / Knowledge Gap Addressed', width: 300, editable: true },
  { key: 'decisionCheckpoint', title: 'Decision Checkpoint', width: 220, editable: true },
  { key: 'expectedData', title: 'Expected date to review', width: 180, editable: true },
  { key: 'name', title: 'Name', width: 140, editable: true },
  { key: 'dateRequired', title: 'Date Required', width: 140, editable: true },
  { key: 'dateCompleted', title: 'Date Completed', width: 140, editable: true },
  { key: 'status', title: 'Status', width: 140, editable: false },
];

export default function ActionPlan({ dataMap, setDataMap, childrenMap = {}, collapsed = new Set(), setCollapsed = () => {} }) {
  // Build hierarchical flat rows
  const buildRows = useCallback(() => {
    const out = [];
    const walk = (parent, prefix = '') => {
      (childrenMap[parent] || []).forEach((id, i) => {
        if (parent !== 'root' && collapsed.has(parent)) return;
        const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const node = dataMap[id] || {};
        const kids = childrenMap[id] || [];
        const progressPct = Math.round((node.progress || 0) * 100);
        out.push({
          id,
            parent,
          index: num,
          isParent: kids.length > 0,
          data: {
            label: node.label || '',
            keyQuestion: node.keyQuestion || '',
            decisionCheckpoint: node.decisionCheckpoint || '',
            expectedData: node.expectedData || '',
            name: node.name || '',
            dateRequired: node.dateRequired || '',
            dateCompleted: node.dateCompleted || '',
            status: progressPct,
          }
        });
        walk(id, num);
      });
    };
    walk('root');
    return out;
  }, [dataMap, childrenMap, collapsed]);

  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState({ id: null, colIdx: null });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);
  const tableRef = useRef(null);

  useEffect(() => { setRows(buildRows()); }, [buildRows]);
  useEffect(() => { if (!editing) return; if (inputRef.current) inputRef.current.focus(); }, [editing]);

  // Persist a changed cell back into dataMap if setter provided
  const commitEdit = useCallback((row, colDef, value) => {
    if (!colDef.editable || !setDataMap) return;
    setDataMap(m => ({
      ...m,
      [row.id]: { ...m[row.id], [colDef.key]: value }
    }));
  }, [setDataMap]);

  const beginEdit = (rowId, colIdx) => {
    const colDef = COLS[colIdx];
    if (!colDef || !colDef.editable) return;
    const row = rows.find(r => r.id === rowId);
    setSel({ id: rowId, colIdx });
    setDraft(row?.data[colDef.key] || '');
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editing || sel.id == null) return;
    const colDef = COLS[sel.colIdx];
    const row = rows.find(r => r.id === sel.id);
    if (row && colDef) {
      commitEdit(row, colDef, draft);
      // Optimistic local update
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, data: { ...r.data, [colDef.key]: draft } } : r));
    }
    setEditing(false);
  };

  const cancelEdit = () => { setEditing(false); };

  const handleCellClick = (rowId, colIdx) => {
    setSel({ id: rowId, colIdx });
    setEditing(false);
  };

  const handleCellDouble = (rowId, colIdx) => beginEdit(rowId, colIdx);

  const onKeyDown = (e) => {
    if (editing) {
      if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      return;
    }
    if (sel.id == null) return;
    const rowIndex = rows.findIndex(r => r.id === sel.id);
    const move = (rDelta, cDelta) => {
      const newRowIdx = Math.min(Math.max(rowIndex + rDelta, 0), rows.length - 1);
      let newColIdx = sel.colIdx ?? 0;
      newColIdx = Math.min(Math.max(newColIdx + cDelta, 0), COLS.length - 1);
      setSel({ id: rows[newRowIdx].id, colIdx: newColIdx });
    };
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); move(1, 0); break;
      case 'ArrowUp': e.preventDefault(); move(-1, 0); break;
      case 'ArrowRight': e.preventDefault(); move(0, 1); break;
      case 'ArrowLeft': e.preventDefault(); move(0, -1); break;
      case 'Enter': e.preventDefault(); beginEdit(sel.id, sel.colIdx); break;
      case 'F2': e.preventDefault(); beginEdit(sel.id, sel.colIdx); break;
      default: break;
    }
  };

  const toggle = (id) => {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
  };

  const ChevronRight = () => <span className="inline-block text-xs">▶</span>;
  const ChevronDown = () => <span className="inline-block text-xs">▼</span>;

  // Inject inline fallback / enhanced styles (only once)
  useEffect(() => {
    if (document.getElementById('ap-styles')) return;
    const style = document.createElement('style');
    style.id = 'ap-styles';
    style.textContent = `
      :root { --ap-border:#cbd5e1; --ap-bg:#ffffff; --ap-bg-alt:#f1f5f9; --ap-bg-hover:#e0f2fe; --ap-header-from:#eef2f7; --ap-header-to:#d9e2ec; --ap-focus:#3b82f6; }
      .ap-wrapper { font: 13px/1.3 system-ui,Segoe UI,Roboto,Arial,sans-serif; background:#f8fafc; }
      .ap-title { margin:0 0 12px; font-size:26px; font-weight:700; color:#0f172a; }
      .ap-container { border:1px solid var(--ap-border); border-radius:8px; background:var(--ap-bg); box-shadow:0 1px 2px rgba(0,0,0,.06); overflow:auto; }
      .ap-table { width:100%; border-spacing:0; table-layout:fixed; }
      .ap-table thead th { position:sticky; top:0; background:linear-gradient(to bottom,var(--ap-header-from),var(--ap-header-to)); font-size:11px; text-transform:uppercase; letter-spacing:.5px; border:1px solid var(--ap-border); padding:6px 8px; text-align:center; font-weight:600; z-index:10; }
      .ap-table tbody td { border:1px solid var(--ap-border); padding:4px 6px; vertical-align:top; background:var(--ap-bg); }
      .ap-row-alt td { background:var(--ap-bg-alt); }
      .ap-row:hover td { background:var(--ap-bg-hover); }
      .ap-cell-sticky { position:sticky; left:0; background:var(--ap-bg); z-index:11; box-shadow:2px 0 0 0 var(--ap-border); }
      .ap-row-alt .ap-cell-sticky { background:var(--ap-bg-alt); }
      .ap-selected { outline:2px solid var(--ap-focus); outline-offset:-2px; background:#dbeafe !important; }
      .ap-edit-input { width:100%; padding:2px 4px; font:inherit; border:1px solid var(--ap-focus); background:#fff; box-shadow:0 0 0 2px rgba(59,130,246,.2); }
      .ap-edit-input:focus { outline:none; }
      .ap-expand-btn { border:1px solid #94a3b8; background:#fff; width:20px; height:20px; font-size:11px; line-height:1; display:inline-flex; align-items:center; justify-content:center; margin-right:4px; border-radius:4px; cursor:pointer; }
      .ap-expand-btn:hover { background:#f1f5f9; }
      .ap-progress-wrap { display:flex; align-items:center; gap:6px; padding-right:8px; }
      .ap-progress-track { flex:1; height:10px; border-radius:4px; background:#e2e8f0; overflow:hidden; position:relative; }
      .ap-progress-bar { height:100%; border-radius:4px; transition:width .35s; }
      .ap-progress-green { background:#16a34a; }
      .ap-progress-amber { background:#d97706; }
      .ap-progress-red { background:#dc2626; }
      .ap-progress-text { font-size:11px; font-weight:600; color:#334155; width:42px; text-align:right; font-variant-numeric:tabular-nums; }
      .ap-hints { display:flex; gap:18px; flex-wrap:wrap; font-size:11px; color:#475569; background:#f1f5f9; border-top:1px solid var(--ap-border); padding:6px 10px; }
      .ap-editable-hint { position:absolute; top:2px; right:2px; font-size:9px; opacity:0; color:#64748b; }
      .ap-row:hover .ap-editable-hint { opacity:.55; }
    `;
    document.head.appendChild(style);
  }, []);

  return (
    <div className="ap-wrapper p-5" onKeyDown={onKeyDown}>
      <h1 className="ap-title">Action Plan</h1>
      <div ref={tableRef} tabIndex={0} className="ap-container">
        <table className="ap-table select-none">
          <thead>
            <tr>
              {COLS.map(c => (
                <th key={c.key} style={{ width: c.width, minWidth: c.width }}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, rIdx) => (
              <tr key={r.id} className={`ap-row ${rIdx % 2 ? 'ap-row-alt' : ''}`}> 
                {COLS.map((c, cIdx) => {
                  const selected = sel.id === r.id && sel.colIdx === cIdx;
                  const editable = c.editable;
                  const value = c.key === 'index' ? r.index : r.data[c.key];
                  const progressClass = value >= 80 ? 'ap-progress-green' : value >= 40 ? 'ap-progress-amber' : 'ap-progress-red';
                  return (
                    <td
                      key={c.key}
                      style={{ width: c.width, minWidth: c.width }}
                      className={`${c.sticky ? 'ap-cell-sticky' : ''} ${selected ? 'ap-selected' : ''}`}
                      onClick={() => handleCellClick(r.id, cIdx)}
                      onDoubleClick={() => handleCellDouble(r.id, cIdx)}
                    >
                      {c.key === 'index' && r.isParent && (
                        <button className="ap-expand-btn" onClick={e => { e.stopPropagation(); toggle(r.id); }}>
                          {collapsed.has(r.id) ? <ChevronRight/> : <ChevronDown/>}
                        </button>
                      )}
                      {selected && editing && COLS[cIdx].editable ? (
                        <input
                          ref={inputRef}
                          value={draft}
                          onChange={e => setDraft(e.target.value)}
                          onBlur={saveEdit}
                          className="ap-edit-input"
                        />
                      ) : c.key === 'status' ? (
                        <div className="ap-progress-wrap">
                          <div className="ap-progress-track">
                            <div className={`ap-progress-bar ${progressClass}`} style={{ width: `${value}%` }} />
                          </div>
                          <span className="ap-progress-text">{value}%</span>
                        </div>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{value}</div>
                      )}
                      {editable && !selected && !editing && (
                        <span className="ap-editable-hint">✎</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={COLS.length} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No tasks yet</td></tr>
            )}
          </tbody>
        </table>
        <div className="ap-hints">
          <span>Enter / F2: Edit</span>
          <span>Esc: Cancel</span>
          <span>Arrows: Move</span>
          <span>Double‑click: Edit cell</span>
        </div>
      </div>
    </div>
  );
}