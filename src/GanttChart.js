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
    }

    componentDidMount() {
        gantt.plugins({
            zoom: true
        });

        gantt.config.fit_tasks = true;

        gantt.config.columns = [
            { name: "text", label: "Task name", tree: true, width: '' },
            { name: "start_date", label: "Start time", align: "center" },
            { name: "duration", label: "Duration", align: "center" },
            { name: "progress", label: "Progress", align: "center", template: (task) => `${Math.round(task.progress * 100)}%` },
            { name: "add", label: "", width: 44 }
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
        this.updateGantt(this.props.dataMap);

        gantt.attachEvent("onAfterTaskAdd", (id, task) => {
            if (this.isTaskBeingAdded) {
                return;
            }
            this.isTaskBeingAdded = true;

            const { setDataMap, setChildrenMap, setCollapsed, dataMap, childrenMap, collapsed } = this.props;
            const newNode = {
                id: task.id,
                label: task.text,
                parent: task.parent,
                category: dataMap[task.parent]?.category || "",
                bg: dataMap[task.parent]?.bg || "#ffffff",
                text: dataMap[task.parent]?.text || "#000000",
            };
            const newDataMap = { ...dataMap, [task.id]: newNode };

            const newChildrenMap = { ...childrenMap };
            if (newChildrenMap[task.parent]) {
                newChildrenMap[task.parent].push(task.id);
            } else {
                newChildrenMap[task.parent] = [task.id];
            }

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

        return { data: tasks, links };
    }

    updateGantt(dataMap) {
        const tasks = this.transformDataForGantt(dataMap);
        gantt.clearAll();
        gantt.parse(tasks);
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
