import React, { Component } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
// Enable manual column resizing in the grid
// Removed static grid_resize import; initialize extension via dhtmlxGantt API

export default class GanttChart extends Component {
    constructor(props) {
        super(props);
        this.ganttContainer = React.createRef();
        this.loadInputRef = React.createRef();
        this.isDragging = false;
        this.lastPosX = 0;
    this.isTaskBeingAdded = false;
    // Flag to prevent recursive updates between Gantt and React state
    this.isSyncing = false;
    }

    componentDidMount() {
        // Enable zoom and column resizing
        gantt.plugins({
            zoom: true,
            grid_resize: true
        });

        gantt.config.fit_tasks = true;

        // Allow columns to be resized by dragging
        gantt.config.columns = [
            { name: "text", label: "Task name", tree: true, width: '', resize: true },
            { name: "start_date", label: "Start time", align: "center", resize: true },
            { name: "duration", label: "Duration", align: "center", resize: true },
            { name: "progress", label: "Progress", align: "center", template: (task) => `${Math.round(task.progress * 100)}%`, resize: true },
            { name: "add", label: "", width: 44, resize: true }
        ];

        gantt.templates.task_class = (start, end, task) => {
            if (task.progress < 0.3) {
                return "progress-low";
            } else if (task.progress < 0.7) {
                return "progress-medium";
            } else {
                return "progress-high";
            }
        };

    gantt.init(this.ganttContainer.current);
        // Add draggable splitter between grid and chart to adjust overall grid width
        setTimeout(() => {
            const container = this.ganttContainer.current;
            if (!container) return;
            const gridEl = container.querySelector('.gantt_grid');
            if (!gridEl) return;
            const splitter = document.createElement('div');
            splitter.style.position = 'absolute';
            splitter.style.top = '0';
            splitter.style.left = gridEl.offsetWidth + 'px';
            splitter.style.width = '4px';
            splitter.style.height = '100%';
            splitter.style.cursor = 'col-resize';
            splitter.style.zIndex = '10';
            container.appendChild(splitter);
            let startX, startWidth;
            const onMouseMove = (e) => {
                const dx = e.clientX - startX;
                const newWidth = Math.max(100, startWidth + dx);
                gantt.config.grid_width = newWidth;
                gantt.render();
                splitter.style.left = newWidth + 'px';
            };
            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };
            splitter.addEventListener('mousedown', (e) => {
                e.preventDefault();
                startX = e.clientX;
                startWidth = gridEl.offsetWidth;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }, 0);
        this.updateGantt(this.props.dataMap);

        // Define a function to inject the task name column resize handle
        const injectColumnResizer = () => {
            const container = this.ganttContainer.current;
            if (!container) return;
            const headerCells = container.querySelectorAll?.('.gantt_grid_head_cell');
            const textHeader = headerCells && headerCells[0];
            // Remove any existing handle to avoid duplicates
            if (textHeader) {
                textHeader.style.position = 'relative';
                const existing = textHeader.querySelector('.col-resize-handle');
                if (existing) existing.remove();
                const colHandle = document.createElement('div');
                colHandle.className = 'col-resize-handle';
                colHandle.style.position = 'absolute';
                colHandle.style.top = '0';
                colHandle.style.right = '0';
                colHandle.style.width = '6px';
                colHandle.style.height = '100%';
                colHandle.style.cursor = 'col-resize';
                colHandle.style.zIndex = '10';
                textHeader.appendChild(colHandle);
                let startX, startWidth;
                const onMouseMove = e => {
                    const dx = e.clientX - startX;
                    const newWidth = Math.max(100, startWidth + dx);
                    gantt.config.columns[0].width = newWidth;
                    // call original render to trigger inject
                    gantt.render();
                };
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                colHandle.addEventListener('mousedown', e => {
                    e.preventDefault();
                    startX = e.clientX;
                    startWidth = textHeader.offsetWidth;
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        // Override gantt.render to always inject the resizer after each render
        const originalRender = gantt.render;
        gantt.render = function() {
            const result = originalRender.apply(this, arguments);
            injectColumnResizer();
            return result;
        };
        // Initial injection
        injectColumnResizer();

        gantt.attachEvent("onAfterTaskAdd", (id, task) => {
            if (this.isTaskBeingAdded) {
                return;
            }
            this.isTaskBeingAdded = true;

            const { setDataMap, setChildrenMap, setCollapsed, dataMap, childrenMap, collapsed } = this.props;
            // Normalize IDs to strings for consistency with FlowChart
            const newId = String(task.id);
            const parentId = String(task.parent);
            const newNode = {
                id: newId,
                label: task.text,
                parent: parentId,
                category: dataMap[parentId]?.category || "",
                bg: dataMap[parentId]?.bg || "#ffffff",
                text: dataMap[parentId]?.text || "#000000",
            };
            const newDataMap = { ...dataMap, [newId]: newNode };

            const newChildrenMap = { ...childrenMap };
            if (newChildrenMap[parentId]) {
                newChildrenMap[parentId].push(newId);
            } else {
                newChildrenMap[parentId] = [newId];
            }

            // Ensure the new node has an initialized children array.
            if (!newChildrenMap[newId]) newChildrenMap[newId] = [];

            const newCollapsed = new Set(collapsed);
            newCollapsed.add(task.id);

            setDataMap(newDataMap);
            setChildrenMap(newChildrenMap);
            setCollapsed(newCollapsed);

            this.isTaskBeingAdded = false;
        });

        gantt.attachEvent("onAfterTaskDelete", (id, task) => {
            const { setDataMap, setChildrenMap, dataMap, childrenMap } = this.props;
            const newDataMap = { ...dataMap };
            delete newDataMap[id];

            const newChildrenMap = { ...childrenMap };
            if (newChildrenMap[task.parent]) {
                newChildrenMap[task.parent] = newChildrenMap[task.parent].filter(
                    (childId) => childId !== id
                );
            }

            setDataMap(newDataMap);
            setChildrenMap(newChildrenMap);
        });

        gantt.attachEvent("onAfterTaskDrag", (id, mode, task, original) => {
            const { setDataMap } = this.props;
            const updatedTask = gantt.getTask(id);
            const newDataMap = { ...this.props.dataMap };
            newDataMap[id] = {
                ...newDataMap[id],
                start_date: this.formatDate(updatedTask.start_date),
                duration: updatedTask.duration,
                progress: updatedTask.progress,
            };
            setDataMap(newDataMap);
        });

        gantt.attachEvent("onAfterTaskChange", (id, task) => {
            const { setDataMap } = this.props;
            const updatedTask = gantt.getTask(id);
            const newDataMap = { ...this.props.dataMap };
            newDataMap[id] = {
                ...newDataMap[id],
                text: updatedTask.text,
                start_date: this.formatDate(updatedTask.start_date),
                duration: updatedTask.duration,
                progress: updatedTask.progress,
            };
            setDataMap(newDataMap);
        });

        gantt.attachEvent("onTaskOpened", (id) => {
            const { setCollapsed, collapsed } = this.props;
            const newCollapsed = new Set(collapsed);
            newCollapsed.delete(id);
            setCollapsed(newCollapsed);
        });

        gantt.attachEvent("onTaskClosed", (id) => {
            const { setCollapsed, collapsed } = this.props;
            const newCollapsed = new Set(collapsed);
            newCollapsed.add(id);
            setCollapsed(newCollapsed);
        });

        gantt.ext.zoom.init({
            levels: [
                { name: "day", scale_height: 27, min_column_width: 80, scales: [{ unit: "day", step: 1, format: "%d %M" }] },
                { name: "week", scale_height: 50, min_column_width: 50, scales: [{ unit: "week", step: 1, format: function (date) { return "Week #" + gantt.date.getWeek(date); } }, { unit: "day", step: 1, format: "%j %D" }] },
                { name: "month", scale_height: 50, min_column_width: 120, scales: [{ unit: "month", step: 1, format: "%F, %Y" }, { unit: "week", step: 1, format: "Week #%W" }] },
                { name: "quarter", scale_height: 50, min_column_width: 90, scales: [{ unit: "quarter", step: 1, format: function (date) { var quarter = Math.floor(date.getMonth() / 3) + 1; return "Q" + quarter; } }, { unit: "month", step: 1, format: "%M" }] },
                { name: "year", scale_height: 50, min_column_width: 30, scales: [{ unit: "year", step: 1, format: "%Y" }] }
            ]
        });

        const timelineHeader = this.ganttContainer.current.querySelector(".gantt_task_scale");
        if (timelineHeader) {
            timelineHeader.addEventListener("mousedown", this.handleMouseDown);
        }
        document.addEventListener("mouseup", this.handleMouseUp);
        document.addEventListener("mousemove", this.handleMouseMove);
    }

    componentWillUnmount() {
        const timelineHeader = this.ganttContainer.current.querySelector(".gantt_task_scale");
        if (timelineHeader) {
            timelineHeader.removeEventListener("mousedown", this.handleMouseDown);
        }
        document.removeEventListener("mouseup", this.handleMouseUp);
        document.removeEventListener("mousemove", this.handleMouseMove);
    }

    componentDidUpdate(prevProps) {
        // If we just synced state to dataMap, skip re-render to avoid loops
        if (this.isSyncing) {
            this.isSyncing = false;
            return;
        }
        if (this.props.dataMap !== prevProps.dataMap) {
            this.updateGantt(this.props.dataMap);
        }
    }

    formatDate(date) {
        const d = new Date(date);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}-${month}-${year}`;
    }

    transformDataForGantt(dataMap) {
        const { collapsed } = this.props;
        const tasks = [];
        const links = [];
        let linkId = 1;

        for (const id in dataMap) {
            const node = dataMap[id];
            tasks.push({
                id: node.id,
                text: node.label,
                start_date: node.start_date || '24-08-2025',
                duration: node.duration || 5,
                parent: id === 'root' ? 0 : node.parent,
                progress: node.progress || 0.5,
                open: !collapsed.has(id),
            });

            if (node.parent) {
                links.push({
                    id: linkId++,
                    source: node.parent,
                    target: node.id,
                    type: gantt.config.links.finish_to_start,
                });
            }
        }

        // Recursively aggregate progress: parent progress = avg of all direct children (including nested)
        const taskMap = {};
        const childrenMap = {};
        tasks.forEach(t => {
            const id = String(t.id);
            taskMap[id] = t;
            const pid = String(t.parent);
            childrenMap[pid] = childrenMap[pid] || [];
            childrenMap[pid].push(id);
        });

        // Recursive function to compute and assign progress
        const computeProgress = (id) => {
            const node = taskMap[id];
            const kids = childrenMap[id] || [];
            if (kids.length === 0) {
                return node.progress || 0;
            }
            const sum = kids.reduce((acc, cid) => acc + computeProgress(cid), 0);
            const avg = sum / kids.length;
            node.progress = avg;
            return avg;
        };

        // Trigger computation for all top-level nodes (parent=0)
        Object.keys(childrenMap)
            .filter(pid => pid === '0')
            .forEach(pid => childrenMap[pid].forEach(computeProgress));

        // Aggregate start/end dates so parent spans from earliest child start to latest child end
        const parseDate = (input) => {
            // If already a Date instance, return it
            if (input instanceof Date) return input;
            // If timestamp or number, convert directly
            if (typeof input === 'number') return new Date(input);
            // If string of format 'DD-MM-YYYY', split and parse
            if (typeof input === 'string' && input.includes('-')) {
                const parts = input.split('-').map(Number);
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    return new Date(y, m - 1, d);
                }
            }
            // Fallback: let Date parser handle it
            return new Date(input);
        };
        const formatDate = (date) => {
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            return `${dd}-${mm}-${yyyy}`;
        };
        const computeBounds = (id) => {
            const node = taskMap[id];
            const kids = childrenMap[id] || [];
            // compute own bounds
            let start = parseDate(node.start_date);
            let end = new Date(start);
            end.setDate(end.getDate() + (node.duration || 0));
            // include children's bounds
            if (kids.length > 0) {
                kids.forEach(cid => {
                    const { start: cs, end: ce } = computeBounds(cid);
                    if (cs < start) start = cs;
                    if (ce > end) end = ce;
                });
                // update node to new bounds
                node.start_date = formatDate(start);
                node.duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
            }
            return { start, end };
        };
        // Apply bounds to top-level nodes (parent=0)
        (childrenMap['0'] || []).forEach(computeBounds);

        return { data: tasks, links };
    }

    updateGantt(dataMap) {
        // Generate tasks and links with aggregated progress
        const { data, links } = this.transformDataForGantt(dataMap);
        gantt.clearAll();
        gantt.parse({ data, links });
    // Note: React state sync removed here to prevent infinite update loops.
    }

    handleMouseDown = (e) => {
        if (e.target.closest(".gantt_task_line")) {
            return;
        }
        this.isDragging = true;
        this.lastPosX = e.clientX;
    }

    handleMouseUp = () => {
        this.isDragging = false;
    }

    handleMouseMove = (e) => {
        if (!this.isDragging) return;
        const delta = e.clientX - this.lastPosX;
        this.lastPosX = e.clientX;
        gantt.scrollTo(gantt.getScrollState().x - delta, null);
    }

    zoomIn = () => {
        gantt.ext.zoom.zoomIn();
    }

    zoomOut = () => {
        gantt.ext.zoom.zoomOut();
    }

    handleSave = async () => {
        const { dataMap, childrenMap, collapsed, costLegend } = this.props;
        const stateToSave = {
            dataMap,
            childrenMap,
            collapsed: Array.from(collapsed),
            costLegend,
        };
        const jsonString = JSON.stringify(stateToSave, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'gantt-chart-project.json',
                    types: [{
                        description: 'JSON File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.error("Error with showSaveFilePicker, falling back:", err);
                }
            }
        }
    }

    handleLoad = () => {
        this.loadInputRef.current.click();
    }

    handleFileChange = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedState = JSON.parse(e.target.result);
                if (loadedState.dataMap && loadedState.childrenMap && loadedState.collapsed && loadedState.costLegend) {
                    this.props.setDataMap(loadedState.dataMap);
                    this.props.setChildrenMap(loadedState.childrenMap);
                    this.props.setCollapsed(new Set(loadedState.collapsed));
                    this.props.setCostLegend(loadedState.costLegend);
                }
            } catch (error) {
                console.error("Error loading file:", error);
            }
        };
        reader.readAsText(file);
        event.target.value = null;
    }

    render() {
        return (
            <div>
                <input
                    type="file"
                    ref={this.loadInputRef}
                    onChange={this.handleFileChange}
                    style={{ display: "none" }}
                    accept=".json"
                />
                <div className="zoom-bar">
                    <button onClick={this.zoomIn}>Zoom In</button>
                    <button onClick={this.zoomOut}>Zoom Out</button>
                    <button onClick={this.handleSave}>Save</button>
                    <button onClick={this.handleLoad}>Load</button>
                </div>
                <div
                    id="gantt_here"
                    ref={this.ganttContainer}
                    style={{ width: '100%', height: 'calc(100vh - 50px)' }}
                ></div>
            </div>
        );
    }
}
