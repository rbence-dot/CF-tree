import React, { Component } from 'react';
import { gantt } from 'dhtmlx-gantt';
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';

export default class GanttChart extends Component {
    constructor(props) {
        super(props);
        this.ganttContainer = React.createRef();
        this.isDragging = false;
        this.lastPosX = 0;
    }

    componentDidMount() {
        gantt.plugins({
            zoom: true
        });

        gantt.config.fit_tasks = true;

        gantt.init(this.ganttContainer.current);
        this.updateGantt(this.props.dataMap);

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

    transformDataForGantt(dataMap) {
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
                progress: 0.5,
                open: true,
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

    render() {
        return (
            <div>
                <div className="zoom-bar">
                    <button onClick={this.zoomIn}>Zoom In</button>
                    <button onClick={this.zoomOut}>Zoom Out</button>
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
