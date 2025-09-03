// Clean single-definition component
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// Column definitions (index aligned with headers)
// Editable excludes index + status
const COLS = [
  { key: 'index', title: '#', width: 70, editable: false, sticky: true },
  { key: 'label', title: 'Assigned Task', width: 260, editable: true },
  { key: 'keyQuestion', title: 'Key Question / Knowledge Gap Addressed', width: 300, editable: true },
  { key: 'decisionCheckpoint', title: 'Decision Checkpoint', width: 220, editable: true },
  { key: 'expectedData', title: 'Expected data to review', width: 180, editable: true },
  { key: 'name', title: 'Name', width: 140, editable: true },
  { key: 'dateRequired', title: 'Date Required', width: 140, editable: false },
  { key: 'dateCompleted', title: 'Date Completed', width: 140, editable: true },
  { key: 'status', title: 'Status', width: 140, editable: false },
];

export default function ActionPlan({ dataMap, setDataMap, childrenMap = {}, collapsed = new Set(), setCollapsed = () => {} }) {
  // Build hierarchical flat rows
  const buildRows = useCallback(() => {
    const out = [];
    // Precompute aggregated progress so parents reflect child updates (mirrors Gantt summary behavior)
    const progressCache = {};
    const computeProgress = (id) => {
      if (progressCache[id] != null) return progressCache[id];
      const kids = childrenMap[id] || [];
      if (!kids.length) {
        // Leaf: take stored progress (0..1) or default 0
        return (progressCache[id] = (dataMap[id]?.progress ?? 0));
      }
      // Average of children (simple unweighted). Could be enhanced to duration‑weighted if durations added.
      const sum = kids.reduce((acc, k) => acc + computeProgress(k), 0);
      return (progressCache[id] = kids.length ? sum / kids.length : 0);
    };
    // Seed computation from root's direct children
    (childrenMap['root'] || []).forEach(id => computeProgress(id));

    // Precompute aggregated end dates (dateRequired) so parent rows update without manual edits
    const endCache = {};
    const parseDateStr = (str) => {
      if (!str || typeof str !== 'string') return null;
      const parts = str.split('-');
      if (parts.length !== 3) return null;
      // Support both dd-mm-yyyy and yyyy-mm-dd
      if (parts[0].length === 4) {
        const [yyyy, mm, dd] = parts.map(Number);
        if ([yyyy, mm, dd].some(isNaN)) return null;
        return new Date(yyyy, mm - 1, dd);
      } else {
        const [dd, mm, yyyy] = parts.map(Number);
        if ([dd, mm, yyyy].some(isNaN)) return null;
        return new Date(yyyy, mm - 1, dd);
      }
    };
    const formatDate = (d) => {
      if (!(d instanceof Date) || isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    };
    const computeEndDate = (id) => {
      if (endCache[id] !== undefined) return endCache[id];
      const node = dataMap[id];
      if (!node) return (endCache[id] = null);
      const kids = childrenMap[id] || [];
      if (!kids.length) {
        // Leaf: derive from its own start_date + duration OR existing dateRequired
        if (node.dateRequired) {
          const d = parseDateStr(node.dateRequired);
          return (endCache[id] = d);
        }
        if (node.start_date && node.duration != null) {
          const s = parseDateStr(node.start_date);
            if (s) { const end = new Date(s); end.setDate(end.getDate() + (parseInt(node.duration, 10) || 0)); return (endCache[id] = end); }
        }
        return (endCache[id] = null);
      }
      // Parent: max of child end dates
      let maxEnd = null;
      kids.forEach(kid => {
        const ce = computeEndDate(kid);
        if (ce && (!maxEnd || ce > maxEnd)) maxEnd = ce;
      });
      return (endCache[id] = maxEnd);
    };
    // Prime cache for root subtree
    (childrenMap['root'] || []).forEach(id => computeEndDate(id));
    const walk = (parent, prefix = '') => {
      (childrenMap[parent] || []).forEach((id, i) => {
        if (parent !== 'root' && collapsed.has(parent)) return;
        const num = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
        const node = dataMap[id] || {};
        const kids = childrenMap[id] || [];
  let effectiveProgress = progressCache[id] != null ? progressCache[id] : (typeof node.progress === 'number' ? node.progress : 0);
  // If stored progress appears to be 0-100 already, convert to 0-1
  if (effectiveProgress > 1) effectiveProgress = effectiveProgress / 100;
  const progressPctRaw = effectiveProgress * 100;
  const progressPct = Number.isFinite(progressPctRaw) ? Math.round(progressPctRaw) : 0;
  // Derive dateRequired: for parents = aggregated child max end; for leaves = existing or computed from own schedule
  let derivedRequired = '';
  const endDate = computeEndDate(id);
  if (endDate) derivedRequired = endDate instanceof Date ? formatDate(endDate) : String(endDate);
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
            dateRequired: derivedRequired || '',
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

  // Normalize missing dateRequired & progress once after load (no infinite loop guard)
  useEffect(() => {
    if (!setDataMap) return;
    let changed = false;
    setDataMap(m => {
      const copy = { ...m };
      Object.keys(copy).forEach(id => {
        const n = copy[id];
        if (!n) return;
        // Normalize progress to fraction 0..1
        if (typeof n.progress === 'number' && n.progress > 1) {
          n.progress = n.progress / 100; changed = true;
        }
        if (n.progress == null) { n.progress = 0; changed = true; }
        // Derive dateRequired from start_date+duration if absent
        if (!n.dateRequired && n.start_date && n.duration != null) {
          const start = (() => {
            const parts = n.start_date.split('-');
            if (parts.length !== 3) return null;
            if (parts[0].length === 4) { // yyyy-mm-dd
              const [Y, M, D] = parts.map(Number); if ([Y,M,D].some(isNaN)) return null; return new Date(Y, M-1, D);
            } else { // dd-mm-yyyy
              const [D, M, Y] = parts.map(Number); if ([Y,M,D].some(isNaN)) return null; return new Date(Y, M-1, D);
            }
          })();
          if (start instanceof Date && !isNaN(start.getTime())) {
            const d = parseInt(n.duration, 10) || 0;
            const end = new Date(start); end.setDate(end.getDate() + d);
            const pad = x => String(x).padStart(2,'0');
            n.dateRequired = `${pad(end.getDate())}-${pad(end.getMonth()+1)}-${end.getFullYear()}`;
            changed = true;
          }
        }
        // Normalize existing ISO dateRequired to dd-mm-yyyy
        if (n.dateRequired && /^\d{4}-\d{2}-\d{2}$/.test(n.dateRequired)) {
          const [Y,M,D] = n.dateRequired.split('-');
          n.dateRequired = `${D}-${M}-${Y}`; changed = true;
        }
      });
      return changed ? copy : m;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState({ id: null, colIdx: null });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showPriority, setShowPriority] = useState(true);
  const inputRef = useRef(null);
  const tableRef = useRef(null);
  // Fill handle (drag-to-fill) state
  const [fillDrag, setFillDrag] = useState(null); // { colIdx, startRow, currentRow, value }

  // Helpers for date conversion (dd-mm-yyyy <-> yyyy-mm-dd)
  const toISODate = (val) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      if (dd.length === 2 && mm.length === 2 && yyyy.length === 4) return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  };
  const fromISODate = (val) => {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      const [yyyy, mm, dd] = parts;
      if (dd && mm && yyyy) return `${dd}-${mm}-${yyyy}`;
    }
    return val;
  };

  useEffect(() => { setRows(buildRows()); }, [buildRows]);
  useEffect(() => { if (!editing) return; if (inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => {
    if (editing && sel.colIdx != null && COLS[sel.colIdx].key === 'dateCompleted' && inputRef.current) {
      // Attempt to auto-open native date picker where supported
      try { inputRef.current.showPicker && inputRef.current.showPicker(); } catch(e) { /* ignore */ }
    }
  }, [editing, sel]);

  // Persist a changed cell back into dataMap if setter provided
  const commitEdit = useCallback((row, colDef, value) => {
    if (!colDef.editable || !setDataMap) return;
    setDataMap(m => ({
      ...m,
      [row.id]: { ...m[row.id], [colDef.key]: value }
    }));
  }, [setDataMap]);

  const beginEdit = (rowId, colIdx, initialChar) => {
    const colDef = COLS[colIdx];
    if (!colDef || !colDef.editable) return;
    const row = rows.find(r => r.id === rowId);
    setSel({ id: rowId, colIdx });
    // If user started typing, replace content with that first char (spreadsheet behavior)
    const existing = row?.data[colDef.key] || '';
    setDraft(initialChar !== undefined ? initialChar : existing);
    setEditing(true);
  };

  const saveEdit = () => {
    if (!editing || sel.id == null) return;
    const colDef = COLS[sel.colIdx];
    const row = rows.find(r => r.id === sel.id);
    if (row && colDef) {
      let finalVal = draft;
      if (colDef.key === 'dateCompleted') {
        finalVal = fromISODate(draft);
      }
      commitEdit(row, colDef, finalVal);
      // Optimistic local update
      const k = colDef.key;
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, data: { ...r.data, [k]: finalVal } } : r));
    }
    setEditing(false);
  };

  const cancelEdit = () => { setEditing(false); };

  const handleCellClick = (rowId, colIdx) => {
    setSel({ id: rowId, colIdx });
    const colDef = COLS[colIdx];
    if (colDef && colDef.key === 'dateCompleted' && colDef.editable) {
      // Open date picker immediately
      beginEdit(rowId, colIdx);
    } else {
      setEditing(false);
    }
    // Ensure key events captured for type-to-edit
    if (tableRef.current) tableRef.current.focus();
  };

  const handleCellDouble = (rowId, colIdx) => beginEdit(rowId, colIdx);

  const onKeyDown = (e) => {
    if (editing) {
      if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
      return;
    }
    if (sel.id == null) return;
    // Type-to-edit: printable characters start editing immediately
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (printable) {
      const colDef = COLS[sel.colIdx];
      if (colDef && colDef.editable) {
        if (colDef.key === 'dateCompleted') {
          // Don't start free-text edit for date picker column on character press
          e.preventDefault();
          beginEdit(sel.id, sel.colIdx);
          return;
        }
        beginEdit(sel.id, sel.colIdx, e.key);
        e.preventDefault();
        return;
      }
    }
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
      case 'Delete': case 'Backspace': {
        const colDef = COLS[sel.colIdx];
        if (colDef?.editable) { beginEdit(sel.id, sel.colIdx, ''); e.preventDefault(); }
        break;
      }
      case 'Tab': {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        const rowIndex = rows.findIndex(r => r.id === sel.id);
        let cIdx = sel.colIdx + dir;
        while (cIdx >=0 && cIdx < COLS.length && !COLS[cIdx].editable) cIdx += dir;
        if (cIdx < 0 || cIdx >= COLS.length) break;
        setSel({ id: rows[rowIndex].id, colIdx: cIdx });
        break;
      }
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
  .ap-table tbody td { position:relative; }
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
  .ap-cell-text { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }
      .ap-fill-handle { position:absolute; width:8px; height:8px; background:#3b82f6; bottom:1px; right:1px; border:1px solid #fff; box-shadow:0 0 0 1px #1d4ed8; cursor:crosshair; border-radius:2px; }
      .ap-fill-target { background:#e0f2fe !important; }
      .ap-fill-source { outline:2px solid #3b82f6; outline-offset:-2px; }
    `;
    document.head.appendChild(style);
  }, []);

  // Global mouse handlers for drag-to-fill
  useEffect(() => {
    if (!fillDrag) return;
    const onMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const tr = el.closest('tr');
      if (!tr || !tr.dataset || tr.dataset.rowIndex == null) return;
      const idx = parseInt(tr.dataset.rowIndex, 10);
      if (!isNaN(idx)) setFillDrag(fd => fd ? { ...fd, currentRow: idx } : fd);
    };
    const onUp = () => {
      setFillDrag(fd => {
        if (!fd) return null;
        const { startRow, currentRow, colIdx, value } = fd;
        const colDef = COLS[colIdx];
        if (!colDef || !colDef.editable) return null;
        const min = Math.min(startRow, currentRow);
        const max = Math.max(startRow, currentRow);
        if (max !== min) {
          const idsToUpdate = rows.slice(min, max + 1).map(r => r.id);
          setDataMap(m => {
            const copy = { ...m };
            idsToUpdate.forEach(id => { copy[id] = { ...copy[id], [colDef.key]: value }; });
            return copy;
          });
          // Optimistic local row update
          setRows(rs => rs.map((r, idx) => (idx >= min && idx <= max) ? { ...r, data: { ...r.data, [colDef.key]: value } } : r));
        }
        return null;
      });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp, { once: true });
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [fillDrag, rows, setDataMap]);

  // Priority list computation: ONLY nodes explicitly flagged (projectMain) excluding root
  const priorityItems = useMemo(() => {
    // Savings: High=30, Medium=20, Low=10 (higher savings => higher score)
    const savingsMap = { High: 30, Medium: 20, Low: 10 };
    // Effort: Low=30, Medium=20, High=10 (lower effort => higher score)
    const effortMap = { Low: 30, Medium: 20, High: 10 };
    const out = [];
    const traverse = (id) => {
      const node = dataMap[id];
      if (!node) return;
      if (id !== 'root' && node.projectMain) {
        const sVal = savingsMap[node.savings] ?? 0;
        const eVal = effortMap[node.effort] ?? 0;
        const score = (sVal + eVal) / 2;
        out.push({ id, label: node.label || id, savings: node.savings || '', effort: node.effort || '', score });
      }
      (childrenMap[id] || []).forEach(traverse);
    };
    traverse('root');
    return out.sort((a, b) => b.score - a.score);
  }, [dataMap, childrenMap]);

  return (
  <div className="ap-wrapper p-5">
      <h1 className="ap-title">Action Plan</h1>
  <div ref={tableRef} tabIndex={0} className="ap-container" onKeyDown={onKeyDown}>
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
              <tr key={r.id} data-row-index={rIdx} className={`ap-row ${rIdx % 2 ? 'ap-row-alt' : ''}`}> 
                {COLS.map((c, cIdx) => {
                  const selected = sel.id === r.id && sel.colIdx === cIdx;
                  const editable = c.editable;
                  const value = c.key === 'index' ? r.index : r.data[c.key];
                  const progressClass = value >= 80 ? 'ap-progress-green' : value >= 40 ? 'ap-progress-amber' : 'ap-progress-red';
                  const inFillRange = fillDrag && fillDrag.colIdx === cIdx && (() => {
                    const min = Math.min(fillDrag.startRow, fillDrag.currentRow);
                    const max = Math.max(fillDrag.startRow, fillDrag.currentRow);
                    if (rIdx === fillDrag.startRow) return false; // source cell styled separately
                    return rIdx >= min && rIdx <= max;
                  })();
                  return (
                    <td
                      key={c.key}
                      style={{ width: c.width, minWidth: c.width }}
                      className={`${c.sticky ? 'ap-cell-sticky' : ''} ${selected ? 'ap-selected' : ''} ${inFillRange ? 'ap-fill-target' : ''} ${(fillDrag && selected && fillDrag.colIdx === cIdx) ? 'ap-fill-source' : ''}`}
                      onClick={() => handleCellClick(r.id, cIdx)}
                      onDoubleClick={() => handleCellDouble(r.id, cIdx)}
                    >
                      {c.key === 'index' && r.isParent && (
                        <button className="ap-expand-btn" onClick={e => { e.stopPropagation(); toggle(r.id); }}>
                          {collapsed.has(r.id) ? <ChevronRight/> : <ChevronDown/>}
                        </button>
                      )}
                                      {selected && editing && COLS[cIdx].editable ? (
                                        c.key === 'dateCompleted' ? (
                                          <input
                                            type="date"
                                            ref={inputRef}
                                            value={toISODate(draft)}
                                            onChange={e => {
                                              const iso = e.target.value;
                                              setDraft(iso);
                                              const finalVal = fromISODate(iso);
                                              // Immediate commit & close to reduce blur issues
                                              const colDef = COLS[cIdx];
                                              commitEdit(r, colDef, finalVal);
                                              setRows(rs => rs.map(rr => rr.id === r.id ? { ...rr, data: { ...rr.data, [colDef.key]: finalVal } } : rr));
                                              setEditing(false);
                                            }}
                                            onBlur={saveEdit}
                                            className="ap-edit-input"
                                          />
                                        ) : (
                                          <input
                                            ref={inputRef}
                                            value={draft}
                                            onChange={e => setDraft(e.target.value)}
                                            onBlur={saveEdit}
                                            className="ap-edit-input"
                                          />
                                        )
                                      ) : c.key === 'status' ? (
                        <div className="ap-progress-wrap">
                          <div className="ap-progress-track">
                            <div className={`ap-progress-bar ${progressClass}`} style={{ width: `${value}%` }} />
                          </div>
                          <span className="ap-progress-text">{value}%</span>
                        </div>
                      ) : (
                        <div className="ap-cell-text" title={value}>{value}</div>
                      )}
                      {selected && !editing && editable && (
                        <div
                          className="ap-fill-handle"
                          onMouseDown={(e) => {
                            e.preventDefault(); e.stopPropagation();
                            setFillDrag({ colIdx: cIdx, startRow: rIdx, currentRow: rIdx, value });
                          }}
                          title="Drag to fill"
                        />
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
      <div style={{ marginTop: 24 }}>
        <button onClick={() => setShowPriority(s => !s)} style={{ border:'1px solid #cbd5e1', background:'#fff', borderRadius:6, padding:'6px 10px', cursor:'pointer', fontSize:13, fontWeight:600 }}>
          {showPriority ? 'Hide' : 'Show'} Priority List
        </button>
        {showPriority && (
          <div style={{ marginTop:12, border:'1px solid #cbd5e1', borderRadius:8, background:'#ffffff', overflow:'hidden' }}>
            <div style={{ padding:'10px 14px', background:'linear-gradient(to bottom,#eef2f7,#d9e2ec)', fontSize:14, fontWeight:600 }}>Priority Ranked Items</div>
            <table style={{ width:'100%', borderSpacing:0, fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f1f5f9', textAlign:'left' }}>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid #cbd5e1' }}>#</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid #cbd5e1' }}>Node</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid #cbd5e1' }}>Savings</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid #cbd5e1' }}>Effort</th>
                  <th style={{ padding:'6px 8px', borderBottom:'1px solid #cbd5e1' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {priorityItems.map((p, idx) => (
                  <tr key={p.id} style={{ background: idx % 2 ? '#f8fafc' : 'white' }}>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid #e2e8f0', width:40 }}>{idx + 1}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid #e2e8f0' }}>{p.label}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid #e2e8f0' }}>{p.savings}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid #e2e8f0' }}>{p.effort}</td>
                    <td style={{ padding:'4px 8px', borderBottom:'1px solid #e2e8f0', fontWeight:600 }}>{p.score}</td>
                  </tr>
                ))}
                {priorityItems.length === 0 && (
                  <tr><td colSpan={5} style={{ padding:'16px', textAlign:'center', color:'#64748b' }}>No qualifying nodes yet</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ padding:'6px 10px', fontSize:11, color:'#475569', background:'#f1f5f9', borderTop:'1px solid #cbd5e1' }}>
              Score = avg( Savings: High=30→Low=10 , Effort: Low=30→High=10 )
            </div>
          </div>
        )}
      </div>
    </div>
  );
}