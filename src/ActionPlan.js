import React, { useState, useEffect, useCallback, useRef } from 'react';
// Single ActionPlan component

export default function ActionPlan({ dataMap, childrenMap = {}, collapsed = new Set(), setCollapsed = () => {} }) {
    const headers = ['#','Assigned Task','Key Question / Knowledge Gap Addressed','Decision Checkpoint','Expected Data to Review','Name','Date Required','Date Completed','Status'];

    const buildRows = useCallback(() => {
      const list = [];
      const dfs = (parent, prefix='') => {
        (childrenMap[parent]||[]).forEach((id,i)=>{
          if(parent!=='root'&&collapsed.has(parent)) return;
          const num=prefix?`${prefix}.${i+1}`:`${i+1}`;
          const node=dataMap[id]||{};
          const isParent=Array.isArray(childrenMap[id])&&childrenMap[id].length>0;
          const status=Math.round((node.progress||0)*100)+'%';
          list.push({id,parent,isParent,values:[num,node.label||'',node.keyQuestion||'',node.decisionCheckpoint||'',node.expectedData||'',node.name||'',node.dateRequired||'',node.dateCompleted||'',status]});
          dfs(id,num);
        });
      };
      dfs('root');
      return list;
    },[dataMap,childrenMap,collapsed]);

    const [rows,setRows]=useState([]);
    const [sel,setSel]=useState({id:null,col:null});
    const [edit,setEdit]=useState(false);
    const [input,setInput]=useState('');
    const ref=useRef();

    useEffect(()=>{setRows(buildRows());},[buildRows]);
    useEffect(()=>{if(edit&&ref.current)ref.current.focus();},[edit]);

    const onClick=(id,col)=>{if(sel.id===id&&sel.col===col&&edit)return;setSel({id,col});setEdit(false);};
    const onDbl=(id,col)=>{setSel({id,col});setEdit(true);const r=rows.find(r=>r.id===id);setInput(r?.values[col]||'');};
    const save=()=>{setRows(rs=>rs.map(r=>r.id===sel.id?{...r,values:(()=>{const v=[...r.values];v[sel.col]=input;return v;})()}:r));setEdit(false);};
    const onKey=e=>e.key==='Enter'&&save();
    const toggle=id=>{const n=new Set(collapsed);collapsed.has(id)?n.delete(id):n.add(id);setCollapsed(n);};

    return(
      <div className="action-plan-wrapper" style={{padding:'16px', overflow:'auto'}}>
        <h2 className="action-plan-title">Action Plan</h2>
        <table className="action-plan-table">
          <thead>
            <tr>
              {headers.map((h,i)=> <th key={i} className={i===0? 'action-plan-number': ''}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> (
              <tr key={r.id}>
                {r.values.map((v,c)=> {
                  if(c===0 && r.isParent){
                    return (
                      <td key={c} className="action-plan-number">
                        <button onClick={()=>toggle(r.id)} className="action-plan-collapse-btn" title={collapsed.has(r.id)?'Expand':'Collapse'}>{collapsed.has(r.id)?'▸':'▾'}</button>{v}
                      </td>
                    );
                  }
                  if(r.parent && collapsed.has(r.parent)) return null;
                  const selected = sel.id===r.id && sel.col===c;
                  return (
                    <td
                      key={c}
                      className={selected? 'action-plan-selected': ''}
                      onClick={()=>onClick(r.id,c)}
                      onDoubleClick={()=>onDbl(r.id,c)}
                    >
                      {selected && edit ? (
                        <input
                          ref={ref}
                          value={input}
                          onChange={e=>setInput(e.target.value)}
                          onBlur={save}
                          onKeyDown={onKey}
                        />
                      ) : (
                        <div style={{whiteSpace:'pre-wrap',wordBreak:'break-word',lineHeight:'1.1rem'}}>{v}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length===0 && (
              <tr>
                <td colSpan={headers.length} style={{textAlign:'center', padding:'24px', color:'#6b7280'}}>No tasks yet</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="action-plan-help">
          <span>Double‑click a cell to edit. Press Enter or click away to save.</span>
        </div>
      </div>
    );
  }
