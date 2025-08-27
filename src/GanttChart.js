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

        const tasks = {
            data: [
                { id: 1, text: "Project Start", start_date: "24-08-2025", duration: 0, progress: 0, open: true, type: gantt.config.types.project },
                { id: 2, text: "Phase 1: Planning", start_date: "25-08-2025", duration: 5, progress: 0.6, parent: 1, open: true },
                { id: 3, text: "Task A: Research & Analysis", start_date: "25-08-2025", duration: 2, progress: 0.8, parent: 2 },
                { id: 4, text: "Task B: Requirements Gathering", start_date: "27-08-2025", duration: 3, progress: 0.4, parent: 2 },
                { id: 5, text: "Phase 2: Development & Implementation", start_date: "01-09-2025", duration: 7, progress: 0.3, parent: 1, open: true },
                { id: 6, text: "Task C: Database Design & Setup", start_date: "01-09-2025", duration: 3, progress: 0.7, parent: 5 },
                { id: 7, text: "Task D: API Development & Integration", start_date: "04-09-2025", duration: 4, progress: 0.2, parent: 5 },
                { id: 8, text: "Phase 3: Testing, Review & Deployment", start_date: "08-09-2025", duration: 4, progress: 0, parent: 1, open: true },
                { id: 9, text: "Task E: Quality Assurance Testing", start_date: "08-09-2025", duration: 2, progress: 0, parent: 8 },
                { id: 10, text: "Task F: Deployment to Production", start_date: "10-09-2025", duration: 2, progress: 0, parent: 8 },
                { id: 11, text: "Project Completion", start_date: "12-09-2025", duration: 0, progress: 0, type: gantt.config.types.milestone }
            ],
            links: [
                { id: 1, source: 2, target: 5, type: gantt.config.links.finish_to_start },
                { id: 2, source: 3, target: 4, type: gantt.config.links.finish_to_start },
                { id: 3, source: 5, target: 8, type: gantt.config.links.finish_to_start },
                { id: 4, source: 6, target: 7, type: gantt.config.links.finish_to_start },
                { id: 5, source: 8, target: 11, type: gantt.config.links.finish_to_start },
                { id: 6, source: 9, target: 10, type: gantt.config.links.finish_to_start }
            ]
        };

        gantt.parse(tasks);

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