import React, { Component } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

// Internal constant to align with other views (FlowChart / ActionPlan)
const ROOT_ID = 'root';

export default class GanttChart extends Component {
	constructor(props) {
		super(props);
		this.ganttContainer = React.createRef();
		this.loadInputRef = React.createRef();
		this.isDragging = false;
		this.lastPosX = 0;
		this.isTaskBeingAdded = false;
		this.isSyncing = false;
	}
	componentDidMount() {
		gantt.plugins({ zoom: true, marker: true });
		gantt.config.fit_tasks = true;
		gantt.config.columns = [
			{ name: 'text', label: 'Task name', tree: true, width: 260 },
			{ name: 'start_date', label: 'Start time', align: 'center' },
			{ name: 'duration', label: 'Duration', align: 'center' },
			{ name: 'progress', label: 'Progress', align: 'center', template: (task) => `${Math.round(task.progress * 100)}%` },
			{ name: 'add', label: '', width: 44 }
		];
		// NOTE: built-in layout resizer may not render in some themes; we'll inject a manual resizer after init as fallback.
		gantt.templates.task_class = (start, end, task) => task.progress < 0.3 ? 'progress-low' : task.progress < 0.7 ? 'progress-medium' : 'progress-high';
		gantt.init(this.ganttContainer.current);
		// Ensure marker styles once
		if (!document.getElementById('gantt-today-marker-styles')) {
			const st = document.createElement('style');
			st.id = 'gantt-today-marker-styles';
			st.textContent = `
				.gantt_marker.today-marker { background:#ef4444; width:2px; z-index:60; }
				.gantt_marker.today-marker .gantt_marker_content { position:absolute; top:0; left:4px; background:#ef4444; color:#fff; font:11px/1.1 system-ui,Segoe UI,Roboto,Arial,sans-serif; padding:2px 5px; border-radius:3px; transform:translateY(-100%); box-shadow:0 1px 2px rgba(0,0,0,.25); }
			`;
			document.head.appendChild(st);
		}
		this.addOrUpdateTodayMarker();
		this.updateGantt(this.props.dataMap);
		gantt.attachEvent('onAfterTaskAdd', (id, task) => {
			// This event sometimes fires twice internally; guard + id / array uniqueness.
			if (this.isTaskBeingAdded) return;
			this.isTaskBeingAdded = true;
			try {
				const { setDataMap, setChildrenMap, setCollapsed, dataMap, childrenMap, collapsed } = this.props;
				const newId = String(id);
				let parentId = String(task.parent);
				// Gantt uses numeric 0 for top-level; normalize to our ROOT_ID
				if (parentId === '0') parentId = ROOT_ID;
				// Skip if node already exists (prevents duplication in ActionPlan)
				if (dataMap[newId]) return;
				const parentNode = dataMap[parentId];
				const baseCategory = parentNode?.category || '';
				// Compute end date (dateRequired) = start_date + duration
				let startStr = task.start_date ? this.formatDate(task.start_date) : undefined;
				let dateRequired;
				if (task.start_date) {
					const s = new Date(task.start_date);
					const d = new Date(s);
					d.setDate(d.getDate() + (task.duration || 0));
					dateRequired = this.formatDate(d);
				}
				const newNode = {
					id: newId,
					label: task.text,
					parent: parentId === ROOT_ID ? ROOT_ID : parentId,
					category: baseCategory,
					bg: parentNode?.bg || '#ffffff',
					text: parentNode?.text || '#000000',
					// seed scheduling / progress data from task object if present
					start_date: startStr,
					dateRequired,
					duration: task.duration,
					progress: typeof task.progress === 'number' ? task.progress : 0
				};
				setDataMap(dm => ({ ...dm, [newId]: newNode }));
				setChildrenMap(cm => {
					const next = { ...cm };
					const arr = next[parentId] ? [...next[parentId]] : [];
					if (!arr.includes(newId)) arr.push(newId);
					next[parentId] = arr;
					if (!next[newId]) next[newId] = [];
					return next;
				});
				setCollapsed(prev => { const ns = new Set(prev); ns.add(newId); return ns; });
			} finally {
				this.isTaskBeingAdded = false;
			}
		});
		gantt.attachEvent('onAfterTaskDelete', (id, task) => {
			const { setDataMap, setChildrenMap, dataMap, childrenMap } = this.props;
			let parentId = String(task.parent);
			if (parentId === '0') parentId = ROOT_ID;
			setDataMap(dm => { const next = { ...dm }; delete next[id]; return next; });
			setChildrenMap(cm => {
				const next = { ...cm };
				if (next[parentId]) next[parentId] = next[parentId].filter(childId => childId !== String(id));
				delete next[id];
				return next;
			});
		});
		gantt.attachEvent('onAfterTaskDrag', (id, mode, task, original) => {
			const { setDataMap } = this.props; const updatedTask = gantt.getTask(id); const endDate = new Date(updatedTask.start_date); endDate.setDate(endDate.getDate() + (updatedTask.duration || 0)); const newDataMap = { ...this.props.dataMap }; newDataMap[id] = { ...newDataMap[id], start_date: this.formatDate(updatedTask.start_date), duration: updatedTask.duration, progress: updatedTask.progress, dateRequired: this.formatDate(endDate) }; setDataMap(newDataMap);
		});
		gantt.attachEvent('onAfterTaskChange', (id, task) => {
			const { setDataMap } = this.props; const updatedTask = gantt.getTask(id); const endDate = new Date(updatedTask.start_date); endDate.setDate(endDate.getDate() + (updatedTask.duration || 0)); const newDataMap = { ...this.props.dataMap }; newDataMap[id] = { ...newDataMap[id], text: updatedTask.text, start_date: this.formatDate(updatedTask.start_date), duration: updatedTask.duration, progress: updatedTask.progress, dateRequired: this.formatDate(endDate) }; setDataMap(newDataMap);
		});
		gantt.attachEvent('onTaskOpened', (id) => { const { setCollapsed, collapsed } = this.props; const nc = new Set(collapsed); nc.delete(id); setCollapsed(nc); });
		gantt.attachEvent('onTaskClosed', (id) => { const { setCollapsed, collapsed } = this.props; const nc = new Set(collapsed); nc.add(id); setCollapsed(nc); });
		gantt.ext.zoom.init({ levels: [ { name: 'day', scale_height: 27, min_column_width: 80, scales: [{ unit: 'day', step: 1, format: '%d %M' }] }, { name: 'week', scale_height: 50, min_column_width: 50, scales: [{ unit: 'week', step: 1, format: date => 'Week #' + gantt.date.getWeek(date) }, { unit: 'day', step: 1, format: '%j %D' }] }, { name: 'month', scale_height: 50, min_column_width: 120, scales: [{ unit: 'month', step: 1, format: '%F, %Y' }, { unit: 'week', step: 1, format: 'Week #%W' }] }, { name: 'quarter', scale_height: 50, min_column_width: 90, scales: [{ unit: 'quarter', step: 1, format: date => 'Q' + (Math.floor(date.getMonth() / 3) + 1) }, { unit: 'month', step: 1, format: '%M' }] }, { name: 'year', scale_height: 50, min_column_width: 30, scales: [{ unit: 'year', step: 1, format: '%Y' }] } ] });
		// Enable horizontal drag scrolling on the timeline header
		// Utility: inject styles for custom resizers (idempotent)
		if (!document.getElementById('gantt-custom-resize-styles')) {
			const st = document.createElement('style');
			st.id = 'gantt-custom-resize-styles';
			st.textContent = `
				.gantt-grid-resizer { position:absolute; top:0; bottom:0; width:8px; cursor:col-resize; background:rgba(148,163,184,0.25); transition:background .15s; z-index:40; }
				.gantt-grid-resizer:hover { background:rgba(59,130,246,0.45); }
				.gantt-grid-resizer.dragging { background:rgba(59,130,246,0.75); }
				.gantt-header-col-resizer { position:absolute; top:0; right:0; width:6px; cursor:col-resize; user-select:none; }
			`;
			document.head.appendChild(st);
		}

		const attachGridResizer = () => {
			const cont = this.ganttContainer.current;
			if (!cont) return;
			const grid = cont.querySelector('.gantt_grid');
			const timeline = cont.querySelector('.gantt_task');
			if (!grid || !timeline) return;
			if (cont.querySelector('.gantt-grid-resizer')) return; // already added
			const resizer = document.createElement('div');
			resizer.className = 'gantt-grid-resizer';
			cont.style.position = 'relative';
			resizer.style.left = grid.offsetWidth - 4 + 'px';
			cont.appendChild(resizer);
			let startX = 0; let startWidth = 0; let dragging = false; let raf = 0;
			const onMove = (e) => {
				if (!dragging) return;
				const dx = e.clientX - startX; const newW = Math.max(140, startWidth + dx);
				if (raf) cancelAnimationFrame(raf);
				raf = requestAnimationFrame(() => {
					gantt.config.grid_width = newW; // built-in property respected by setSizes
					gantt.setSizes();
					resizer.style.left = (newW - 4) + 'px';
				});
			};
			const onUp = () => { if (!dragging) return; dragging = false; resizer.classList.remove('dragging'); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
			resizer.addEventListener('mousedown', (e) => { e.preventDefault(); startX = e.clientX; startWidth = grid.offsetWidth; dragging = true; resizer.classList.add('dragging'); document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp); });
		};

		const attachHeaderColumnResizer = () => {
			const cont = this.ganttContainer.current; if (!cont) return;
			// Try several selectors to find the task name header cell (library versions differ)
			const candidates = [
				'.gantt_grid_head_cell[data-column-name="text"]',
				'.gantt_grid_head_cell[name="text"]',
				'.gantt_grid_head_cell.gantt_grid_head_text',
				'.gantt_grid_head_cell'
			];
			let headerCell = null;
			for (const sel of candidates) { const el = cont.querySelector(sel); if (el) { headerCell = el; break; } }
			if (!headerCell) return;
			if (headerCell.querySelector('.gantt-header-col-resizer')) return; // already added
			headerCell.style.position = 'relative';
			const r = document.createElement('div');
			r.className = 'gantt-header-col-resizer';
			Object.assign(r.style, { background:'transparent' });
			headerCell.appendChild(r);
			let sx=0, sw=0, dragging=false, frame=0;
			const move = (e) => { if(!dragging) return; const dx = e.clientX - sx; const nw = Math.max(120, sw + dx); if (frame) cancelAnimationFrame(frame); frame = requestAnimationFrame(()=>{ gantt.config.columns[0].width = nw; gantt.render(); }); };
			const up = () => { if(!dragging) return; dragging=false; r.style.background='transparent'; document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
			r.addEventListener('mousedown', e => { e.stopPropagation(); e.preventDefault(); dragging=true; sx=e.clientX; sw=headerCell.getBoundingClientRect().width; r.style.background='rgba(59,130,246,0.45)'; document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); });
		};

		// Always-visible overlay resizer specifically for first (task name) column
		const attachFirstColumnOverlayResizer = () => {
			const cont = this.ganttContainer.current; if (!cont) return;
			if (cont.querySelector('.gantt-firstcol-resizer')) return;
			const gridHead = cont.querySelector('.gantt_grid_scale');
			if (!gridHead) return;
			const overlay = document.createElement('div');
			overlay.className = 'gantt-firstcol-resizer';
			const ensureStyles = () => {
				if (!document.getElementById('gantt-firstcol-resize-styles')) {
					const st = document.createElement('style');
					st.id = 'gantt-firstcol-resize-styles';
					st.textContent = `
						.gantt-firstcol-resizer { position:absolute; top:0; width:6px; cursor:col-resize; background:rgba(37,99,235,0.25); z-index:50; }
						.gantt-firstcol-resizer:hover { background:rgba(37,99,235,0.55); }
						.gantt-firstcol-resizer.dragging { background:rgba(37,99,235,0.85); }
					`;
					document.head.appendChild(st);
				}
			};
			ensureStyles();
			cont.style.position = 'relative';
			cont.appendChild(overlay);
			const positionOverlay = () => {
				const firstHeaderCell = cont.querySelector('.gantt_grid_head_cell');
				if (!firstHeaderCell) return;
				const rect = firstHeaderCell.getBoundingClientRect();
				const gridRect = cont.getBoundingClientRect();
				const left = rect.right - gridRect.left - cont.scrollLeft; // relative
				overlay.style.left = (left - 3) + 'px';
				overlay.style.height = cont.querySelector('.gantt_grid')?.offsetHeight + 'px';
			};
			let sx=0, sw=0, dragging=false, frame=0;
			const move = (e) => { if(!dragging) return; const dx = e.clientX - sx; const nw = Math.max(120, sw + dx); if (frame) cancelAnimationFrame(frame); frame = requestAnimationFrame(()=>{ gantt.config.columns[0].width = nw; gantt.render(); }); };
			const up = () => { if(!dragging) return; dragging=false; overlay.classList.remove('dragging'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); positionOverlay(); };
			overlay.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); const firstHeaderCell = cont.querySelector('.gantt_grid_head_cell'); if (!firstHeaderCell) return; sx = e.clientX; sw = firstHeaderCell.getBoundingClientRect().width; dragging = true; overlay.classList.add('dragging'); document.addEventListener('mousemove', move); document.addEventListener('mouseup', up); });
			positionOverlay();
			if (!this._firstColRenderEvt) {
				this._firstColRenderEvt = gantt.attachEvent('onGanttRender', () => { positionOverlay(); });
			}
			window.addEventListener('resize', positionOverlay);
		};

		// Re-attach on each gantt render to survive internal re-renders
		if (!this._columnResizeEvt) {
			this._columnResizeEvt = gantt.attachEvent('onGanttRender', () => {
				attachHeaderColumnResizer();
			});
		}

		setTimeout(() => {
			const timelineHeader = this.ganttContainer.current?.querySelector('.gantt_task_scale');
			if (timelineHeader) {
				timelineHeader.style.cursor = 'grab';
				timelineHeader.addEventListener('mousedown', this.handleMouseDown);
				document.addEventListener('mousemove', this.handleMouseMove);
				document.addEventListener('mouseup', this.handleMouseUp);
			}
			attachGridResizer();
			attachHeaderColumnResizer();
			attachFirstColumnOverlayResizer();
		}, 0);
	}
	componentWillUnmount() {
		const timelineHeader = this.ganttContainer.current?.querySelector('.gantt_task_scale'); if (timelineHeader) timelineHeader.removeEventListener('mousedown', this.handleMouseDown); document.removeEventListener('mouseup', this.handleMouseUp); document.removeEventListener('mousemove', this.handleMouseMove);
	}
	componentDidUpdate(prevProps) { if (this.isSyncing) { this.isSyncing = false; return; } if (this.props.dataMap !== prevProps.dataMap) this.updateGantt(this.props.dataMap); }
	formatDate(date) { const d = new Date(date); const day = String(d.getDate()).padStart(2, '0'); const month = String(d.getMonth() + 1).padStart(2, '0'); const year = d.getFullYear(); return `${day}-${month}-${year}`; }
	transformDataForGantt(dataMap) { const { collapsed } = this.props; const tasks = []; const links = []; let linkId = 1; for (const id in dataMap) { const node = dataMap[id];
		// Normalize progress: accept 0, convert >1 (likely percent) down to 0-1, clamp
		let prog = node.progress; if (typeof prog !== 'number' || isNaN(prog)) prog = 0; if (prog > 1) prog = prog / 100; if (prog < 0) prog = 0; if (prog > 1) prog = 1;
		let startVal = node.start_date; let durationVal = node.duration;
		if ((startVal == null || durationVal == null) && node.parent && dataMap[node.parent]) {
			const p = dataMap[node.parent];
			if (p && p.start_date != null && p.duration != null) {
				// Inherit parent's schedule to avoid expanding parent bounds when unscheduled child is added from FlowChart
				startVal = startVal ?? p.start_date;
				durationVal = durationVal ?? p.duration;
			}
		}
		if (startVal == null) startVal = '24-08-2025';
		if (durationVal == null) durationVal = 5;
		tasks.push({ id: node.id, text: node.label, start_date: startVal, duration: durationVal, parent: id === 'root' ? 0 : node.parent, progress: prog, open: !collapsed.has(id) }); if (node.parent) links.push({ id: linkId++, source: node.parent, target: node.id, type: gantt.config.links.finish_to_start }); }
		const taskMap = {}; const childrenMap = {}; tasks.forEach(t => { const id = String(t.id); taskMap[id] = t; const pid = String(t.parent); childrenMap[pid] = childrenMap[pid] || []; childrenMap[pid].push(id); });
		const computeProgress = (id) => { const node = taskMap[id]; const kids = childrenMap[id] || []; if (!kids.length) return node.progress || 0; const sum = kids.reduce((acc, cid) => acc + computeProgress(cid), 0); const avg = sum / kids.length; node.progress = avg; return avg; };
		Object.keys(childrenMap).filter(pid => pid === '0').forEach(pid => childrenMap[pid].forEach(computeProgress));
		const parseDate = (input) => { if (input instanceof Date) return input; if (typeof input === 'number') return new Date(input); if (typeof input === 'string' && input.includes('-')) { const parts = input.split('-').map(Number); if (parts.length === 3) { const [d, m, y] = parts; return new Date(y, m - 1, d); } } return new Date(input); };
		const formatDate = (date) => { const dd = String(date.getDate()).padStart(2, '0'); const mm = String(date.getMonth() + 1).padStart(2, '0'); const yyyy = date.getFullYear(); return `${dd}-${mm}-${yyyy}`; };
		const computeBounds = (id) => { const node = taskMap[id]; const kids = childrenMap[id] || []; let start = parseDate(node.start_date); let end = new Date(start); end.setDate(end.getDate() + (node.duration || 0)); if (kids.length) { kids.forEach(cid => { const { start: cs, end: ce } = computeBounds(cid); if (cs < start) start = cs; if (ce > end) end = ce; }); node.start_date = formatDate(start); node.duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)); } return { start, end }; };
		(childrenMap['0'] || []).forEach(computeBounds); return { data: tasks, links }; }
	updateGantt(dataMap) { const { data, links } = this.transformDataForGantt(dataMap); gantt.clearAll(); gantt.parse({ data, links }); this.addOrUpdateTodayMarker(); }
	addOrUpdateTodayMarker() {
		const dateToStr = gantt.date.date_to_str('%d-%m-%Y');
		const today = new Date(); today.setHours(0,0,0,0);
		if (this.todayMarkerId) { gantt.deleteMarker(this.todayMarkerId); }
		this.todayMarkerId = gantt.addMarker({ start_date: today, css: 'today-marker', text: 'Today', title: 'Today: ' + dateToStr(today) });
		gantt.render();
	}
	handleMouseDown = (e) => { if (e.button !== 0) return; if (e.target.closest('.gantt_task_line')) return; this.isDragging = true; this.lastPosX = e.clientX; const timelineHeader = this.ganttContainer.current?.querySelector('.gantt_task_scale'); if (timelineHeader) timelineHeader.style.cursor = 'grabbing'; }
	handleMouseUp = () => { if (!this.isDragging) return; this.isDragging = false; const timelineHeader = this.ganttContainer.current?.querySelector('.gantt_task_scale'); if (timelineHeader) timelineHeader.style.cursor = 'grab'; }
	handleMouseMove = (e) => { if (!this.isDragging) return; const delta = e.clientX - this.lastPosX; this.lastPosX = e.clientX; gantt.scrollTo(gantt.getScrollState().x - delta, null); }
	zoomIn = () => { gantt.ext.zoom.zoomIn(); }
	zoomOut = () => { gantt.ext.zoom.zoomOut(); }
		render() { return (<div><div className="zoom-bar"><button onClick={this.zoomIn}>Zoom In</button><button onClick={this.zoomOut}>Zoom Out</button></div><div id="gantt_here" ref={this.ganttContainer} style={{ width: '100%', height: 'calc(100vh - 50px)' }}></div></div>); }
}
