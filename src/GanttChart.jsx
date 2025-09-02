import React, { Component } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

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
		gantt.plugins({ zoom: true });
		gantt.config.fit_tasks = true;
		gantt.config.columns = [
			{ name: 'text', label: 'Task name', tree: true, width: '' },
			{ name: 'start_date', label: 'Start time', align: 'center' },
			{ name: 'duration', label: 'Duration', align: 'center' },
			{ name: 'progress', label: 'Progress', align: 'center', template: (task) => `${Math.round(task.progress * 100)}%` },
			{ name: 'add', label: '', width: 44 }
		];
		gantt.templates.task_class = (start, end, task) => task.progress < 0.3 ? 'progress-low' : task.progress < 0.7 ? 'progress-medium' : 'progress-high';
		gantt.init(this.ganttContainer.current);
		this.updateGantt(this.props.dataMap);
		gantt.attachEvent('onAfterTaskAdd', (id, task) => {
			if (this.isTaskBeingAdded) return; this.isTaskBeingAdded = true;
			const { setDataMap, setChildrenMap, setCollapsed, dataMap, childrenMap, collapsed } = this.props;
			const newId = String(task.id); const parentId = String(task.parent);
			const newNode = { id: newId, label: task.text, parent: parentId, category: dataMap[parentId]?.category || '', bg: dataMap[parentId]?.bg || '#ffffff', text: dataMap[parentId]?.text || '#000000' };
			const newDataMap = { ...dataMap, [newId]: newNode };
			const newChildrenMap = { ...childrenMap }; if (newChildrenMap[parentId]) newChildrenMap[parentId].push(newId); else newChildrenMap[parentId] = [newId]; if (!newChildrenMap[newId]) newChildrenMap[newId] = [];
			const newCollapsed = new Set(collapsed); newCollapsed.add(task.id);
			setDataMap(newDataMap); setChildrenMap(newChildrenMap); setCollapsed(newCollapsed); this.isTaskBeingAdded = false;
		});
		gantt.attachEvent('onAfterTaskDelete', (id, task) => {
			const { setDataMap, setChildrenMap, dataMap, childrenMap } = this.props;
			const newDataMap = { ...dataMap }; delete newDataMap[id];
			const newChildrenMap = { ...childrenMap }; if (newChildrenMap[task.parent]) newChildrenMap[task.parent] = newChildrenMap[task.parent].filter(childId => childId !== id);
			setDataMap(newDataMap); setChildrenMap(newChildrenMap);
		});
		gantt.attachEvent('onAfterTaskDrag', (id, mode, task, original) => {
			const { setDataMap } = this.props; const updatedTask = gantt.getTask(id); const newDataMap = { ...this.props.dataMap }; newDataMap[id] = { ...newDataMap[id], start_date: this.formatDate(updatedTask.start_date), duration: updatedTask.duration, progress: updatedTask.progress }; setDataMap(newDataMap);
		});
		gantt.attachEvent('onAfterTaskChange', (id, task) => {
			const { setDataMap } = this.props; const updatedTask = gantt.getTask(id); const newDataMap = { ...this.props.dataMap }; newDataMap[id] = { ...newDataMap[id], text: updatedTask.text, start_date: this.formatDate(updatedTask.start_date), duration: updatedTask.duration, progress: updatedTask.progress }; setDataMap(newDataMap);
		});
		gantt.attachEvent('onTaskOpened', (id) => { const { setCollapsed, collapsed } = this.props; const nc = new Set(collapsed); nc.delete(id); setCollapsed(nc); });
		gantt.attachEvent('onTaskClosed', (id) => { const { setCollapsed, collapsed } = this.props; const nc = new Set(collapsed); nc.add(id); setCollapsed(nc); });
		gantt.ext.zoom.init({ levels: [ { name: 'day', scale_height: 27, min_column_width: 80, scales: [{ unit: 'day', step: 1, format: '%d %M' }] }, { name: 'week', scale_height: 50, min_column_width: 50, scales: [{ unit: 'week', step: 1, format: date => 'Week #' + gantt.date.getWeek(date) }, { unit: 'day', step: 1, format: '%j %D' }] }, { name: 'month', scale_height: 50, min_column_width: 120, scales: [{ unit: 'month', step: 1, format: '%F, %Y' }, { unit: 'week', step: 1, format: 'Week #%W' }] }, { name: 'quarter', scale_height: 50, min_column_width: 90, scales: [{ unit: 'quarter', step: 1, format: date => 'Q' + (Math.floor(date.getMonth() / 3) + 1) }, { unit: 'month', step: 1, format: '%M' }] }, { name: 'year', scale_height: 50, min_column_width: 30, scales: [{ unit: 'year', step: 1, format: '%Y' }] } ] });
	}
	componentWillUnmount() {
		const timelineHeader = this.ganttContainer.current?.querySelector('.gantt_task_scale'); if (timelineHeader) timelineHeader.removeEventListener('mousedown', this.handleMouseDown); document.removeEventListener('mouseup', this.handleMouseUp); document.removeEventListener('mousemove', this.handleMouseMove);
	}
	componentDidUpdate(prevProps) { if (this.isSyncing) { this.isSyncing = false; return; } if (this.props.dataMap !== prevProps.dataMap) this.updateGantt(this.props.dataMap); }
	formatDate(date) { const d = new Date(date); const day = String(d.getDate()).padStart(2, '0'); const month = String(d.getMonth() + 1).padStart(2, '0'); const year = d.getFullYear(); return `${day}-${month}-${year}`; }
	transformDataForGantt(dataMap) { const { collapsed } = this.props; const tasks = []; const links = []; let linkId = 1; for (const id in dataMap) { const node = dataMap[id]; tasks.push({ id: node.id, text: node.label, start_date: node.start_date || '24-08-2025', duration: node.duration || 5, parent: id === 'root' ? 0 : node.parent, progress: node.progress || 0.5, open: !collapsed.has(id) }); if (node.parent) links.push({ id: linkId++, source: node.parent, target: node.id, type: gantt.config.links.finish_to_start }); }
		const taskMap = {}; const childrenMap = {}; tasks.forEach(t => { const id = String(t.id); taskMap[id] = t; const pid = String(t.parent); childrenMap[pid] = childrenMap[pid] || []; childrenMap[pid].push(id); });
		const computeProgress = (id) => { const node = taskMap[id]; const kids = childrenMap[id] || []; if (!kids.length) return node.progress || 0; const sum = kids.reduce((acc, cid) => acc + computeProgress(cid), 0); const avg = sum / kids.length; node.progress = avg; return avg; };
		Object.keys(childrenMap).filter(pid => pid === '0').forEach(pid => childrenMap[pid].forEach(computeProgress));
		const parseDate = (input) => { if (input instanceof Date) return input; if (typeof input === 'number') return new Date(input); if (typeof input === 'string' && input.includes('-')) { const parts = input.split('-').map(Number); if (parts.length === 3) { const [d, m, y] = parts; return new Date(y, m - 1, d); } } return new Date(input); };
		const formatDate = (date) => { const dd = String(date.getDate()).padStart(2, '0'); const mm = String(date.getMonth() + 1).padStart(2, '0'); const yyyy = date.getFullYear(); return `${dd}-${mm}-${yyyy}`; };
		const computeBounds = (id) => { const node = taskMap[id]; const kids = childrenMap[id] || []; let start = parseDate(node.start_date); let end = new Date(start); end.setDate(end.getDate() + (node.duration || 0)); if (kids.length) { kids.forEach(cid => { const { start: cs, end: ce } = computeBounds(cid); if (cs < start) start = cs; if (ce > end) end = ce; }); node.start_date = formatDate(start); node.duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)); } return { start, end }; };
		(childrenMap['0'] || []).forEach(computeBounds); return { data: tasks, links }; }
	updateGantt(dataMap) { const { data, links } = this.transformDataForGantt(dataMap); gantt.clearAll(); gantt.parse({ data, links }); }
	handleMouseDown = (e) => { if (e.target.closest('.gantt_task_line')) return; this.isDragging = true; this.lastPosX = e.clientX; }
	handleMouseUp = () => { this.isDragging = false; }
	handleMouseMove = (e) => { if (!this.isDragging) return; const delta = e.clientX - this.lastPosX; this.lastPosX = e.clientX; gantt.scrollTo(gantt.getScrollState().x - delta, null); }
	zoomIn = () => { gantt.ext.zoom.zoomIn(); }
	zoomOut = () => { gantt.ext.zoom.zoomOut(); }
	handleSave = async () => { const { dataMap, childrenMap, collapsed, costLegend } = this.props; const stateToSave = { dataMap, childrenMap, collapsed: Array.from(collapsed), costLegend }; const jsonString = JSON.stringify(stateToSave, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); if (window.showSaveFilePicker) { try { const handle = await window.showSaveFilePicker({ suggestedName: 'gantt-chart-project.json', types: [{ description: 'JSON File', accept: { 'application/json': ['.json'] }, }], }); const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); } catch (err) { if (err.name !== 'AbortError') console.error('Error with showSaveFilePicker, falling back:', err); } } }
	handleLoad = () => { this.loadInputRef.current.click(); }
	handleFileChange = (event) => { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (e) => { try { const loadedState = JSON.parse(e.target.result); if (loadedState.dataMap && loadedState.childrenMap && loadedState.collapsed && loadedState.costLegend) { this.props.setDataMap(loadedState.dataMap); this.props.setChildrenMap(loadedState.childrenMap); this.props.setCollapsed(new Set(loadedState.collapsed)); this.props.setCostLegend(loadedState.costLegend); } } catch (error) { console.error('Error loading file:', error); } }; reader.readAsText(file); event.target.value = null; }
	render() { return (<div><input type="file" ref={this.loadInputRef} onChange={this.handleFileChange} style={{ display: 'none' }} accept=".json" /><div className="zoom-bar"><button onClick={this.zoomIn}>Zoom In</button><button onClick={this.zoomOut}>Zoom Out</button><button onClick={this.handleSave}>Save</button><button onClick={this.handleLoad}>Load</button></div><div id="gantt_here" ref={this.ganttContainer} style={{ width: '100%', height: 'calc(100vh - 50px)' }}></div></div>); }
}
