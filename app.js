  /**
 * Main application module for managing tasks with countdown, filters and validation.
 * Uses an IIFE to avoid polluting the global scope.
 */
const App = (function () {

    let taskManager;
    let saveButtonEl;
    let taskNameEl;
    let taskCategoryEl;
    let priorityInputsEls;
    let dueDateEl;
    let taskDescriptionEl;
    let taskNameErrorEl;
    let taskCategoryErrorEl;
    let priorityErrorEl;
    let dueDateErrorEl;
    let taskDescriptionErrorEl;
    let addTaskButtonEl;
    let taskModalEl;
    let headerCloseBtnEl;
    let closeButtonEl;
    let taskFormEl;
    let taskModalInstance;
    let tasksContainerEl;
    let taskRenderer;
    let categoryFilterEl;
    let sortByDateFilterEl;
    let editingTaskId = null;
    let modalTitleEl;
    let priorityContainerEl;
    let countdownIntervalId = null;

    /** @type {string[]} all available task categories */
    const CATEGORIES = ["Work", "School", "Fitness", "Shopping"];
    /** @type {string[]} all available priority levels */
    const PRIORITIES = ["Low", "Medium", "High"];

    /**
     * Static class responsible for validating task input fields.
     * All methods return either an empty string (no error) or an error message.
     */
    class TaskValidator {
        static validateTask(task) {
            const v = new TaskValidator();

            const errors = {
                name: v.#validateName(task.name),
                category: v.#validateCategory(task.category),
                priority: v.#validatePriority(task.priority),
                date: v.#validateDate(task.date),
                description: v.#validateDescription(task.description)
            };

            return {
                isValid: Object.values(errors).every(e => !e),
                errors
            };
        }

        #nameRegex = /^[\p{L}\p{N} ]+$/u;
        #descriptionRegex = /^[\p{L}\p{N}\s.,!?;:'"()\-_/]+$/u;


        #validateName(name) {
            if (typeof name !== "string") return "Name is required";
            const t = name.trim();
            if (!t) return "Name is required";
            if (!this.#nameRegex.test(t))
                return "Name can contain only letters, numbers and spaces";
            return "";
        }

        #validateCategory(category) {
            if (!category) return "Category is required";
            if (!CATEGORIES.includes(category))
                return "Category is invalid";
            return "";
        }

        #validatePriority(priority) {
            if (!priority) return "Priority is required";
            if (!PRIORITIES.includes(priority))
                return "Priority is invalid";
            return "";
        }

        #validateDate(dateStr) {
            const d = new Date(dateStr);
            if (Number.isNaN(d.getTime()))
                return "Date is invalid";
            return "";
        }

        #validateDescription(desc) {
            if (!desc || !desc.trim()) return "";
            if (!this.#descriptionRegex.test(desc))
                return "Invalid description";
            return "";
        }
    }



      /**
     * Represents a single task entity with basic properties and update logic.
     */
    class Task {
        #id;
        #name;
        #category;
        #priority;
        #date;
        #description;

        /**
         * @param {number} id - Unique id of the task.
         * @param {string} name
         * @param {string} category
         * @param {string} priority
         * @param {string} date - ISO-like string from input.
         * @param {string} description
         */
        constructor(id, name, category, priority, date, description) {
            this.#id = id;
            this.#name = name;
            this.#category = category;
            this.#priority = priority;
            this.#date = date;
            this.#description = description;
        }

        get id()          { return this.#id; }
        get name()        { return this.#name; }
        get category()    { return this.#category; }
        get priority()    { return this.#priority; }
        get date()        { return this.#date; }
        get description() { return this.#description; }

        /**
         * Update all editable fields of the task.
         * @param {Object} param0 - New values for the task.
         * @param {string} param0.name
         * @param {string} param0.category
         * @param {string} param0.priority
         * @param {string} param0.date
         * @param {string} param0.description
         */
        update({ name, category, priority, date, description }) {
            this.#name        = name;
            this.#category    = category;
            this.#priority    = priority;
            this.#date        = date;
            this.#description = description;
        }
    }

    /**
     * Manages the in-memory collection of tasks (add, delete, update, list).
     */
    class TaskManager {
        #tasks;
        #nextId;

        constructor() {
            this.#tasks = [];
            this.#nextId = 1;
        }

        /**
         * Create and add a new Task instance to the list.
         * @returns {Task} The created task.
         */
        addTask(name, category, priority, date, description) {
            const task = new Task(
                this.#nextId++,
                name,
                category,
                priority,
                date,
                description
            );

            this.#tasks.push(task);
            return task;
        }

        /**
         * Get a shallow copy of all tasks.
         * @returns {Task[]} Array of tasks.
         */
        getTasks() {
            return [...this.#tasks];
        }

        /**
         * Remove a task by id.
         * @param {number} id - Task id to delete.
         */
        deleteTask(id) {
            this.#tasks = this.#tasks.filter(task => task.id !== id);
        }

        /**
         * Update an existing task by id if it exists.
         * @param {number} id - Task id to update.
         * @param {Object} fields - New values for the task fields.
         */
        updateTask(id, { name, category, priority, date, description }) {
            const task = this.#tasks.find(t => t.id === id);
            if (!task) return;
            task.update({ name, category, priority, date, description });
        }
    }

    /**
     * Responsible for rendering tasks into the DOM and wiring button events.
     */
    class TaskRenderer {
        #container;
        #onDelete;
        #onEdit;

        /**
         * @param {HTMLElement} containerEl - The element that will contain the task cards.
         * @param {(id:number)=>void} onDelete - Callback when delete button is clicked.
         * @param {(task:Task)=>void} onEdit - Callback when edit button is clicked.
         */
        constructor(containerEl, onDelete, onEdit) {
            this.#container = containerEl;
            this.#onDelete = onDelete;
            this.#onEdit   = onEdit;
        }

        /**
         * Render a full list of tasks into the container.
         * Clears previous content and rebuilds the list.
         * @param {Task[]} tasks - Tasks to render.
         */
        renderTasks(tasks) {
            this.#container.innerHTML = "";

            if (tasks.length === 0) {
                const info = document.createElement("p");
                info.className = "text-muted text-center py-3";
                info.textContent = 'No tasks yet. Click "New Task" to add one.';
                this.#container.appendChild(info);
                return;
            }

            tasks.forEach(task => {
                const card = this.#createTaskCard(task);
                this.#container.appendChild(card);
            });
        }

        /**
         * Create a Bootstrap card element for a single task.
         * @param {Task} task - Task to render.
         * @returns {HTMLDivElement} Card element representing the task.
         */
        #createTaskCard(task) {
            const { label: timeLeftLabel, expired } = getTimeLeftInfo(task.date);

            const card = document.createElement("div");
            card.className = "card mb-3";
            // for optimized countdown updates
            card.dataset.taskId = String(task.id);

            if (expired) {
                card.classList.add("border-danger", "bg-light", "opacity-75");
            }

            const body = document.createElement("div");
            body.className = "card-body";

            const titleRow = document.createElement("div");
            titleRow.className = "d-flex justify-content-between align-items-start";

            const titleEl = document.createElement("h5");
            titleEl.className = "card-title mb-1";
            titleEl.textContent = task.name;

            const badgeEl = document.createElement("span");
            badgeEl.className = "badge bg-secondary";
            badgeEl.textContent = task.category;

            titleRow.appendChild(titleEl);
            titleRow.appendChild(badgeEl);

            // meta: time left + priority badge
            const metaEl = document.createElement("div");
            metaEl.className = "d-flex justify-content-between align-items-center mb-2";

            const timeEl = document.createElement("span");
            // add time-left class so we can update just this span
            timeEl.className = "text-muted small time-left";
            timeEl.textContent = timeLeftLabel;

            const priorityBadge = document.createElement("span");
            priorityBadge.className = "badge " + getPriorityBadgeClass(task.priority);
            priorityBadge.textContent = task.priority;

            metaEl.appendChild(timeEl);
            metaEl.appendChild(priorityBadge);

            const descEl = document.createElement("p");
            descEl.className = "card-text mb-2";
            descEl.textContent = task.description;

            const footerEl = document.createElement("div");
            footerEl.className = "d-flex justify-content-end gap-2";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "btn btn-sm btn-outline-primary";
            editBtn.textContent = "Edit";

            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-sm btn-outline-danger";
            deleteBtn.textContent = "Delete";

            deleteBtn.addEventListener("click", () => {
                this.#onDelete(task.id);
            });

            editBtn.addEventListener("click", () => {
                if (this.#onEdit) {
                    this.#onEdit(task);
                }
            });

            footerEl.appendChild(editBtn);
            footerEl.appendChild(deleteBtn);

            body.appendChild(titleRow);
            body.appendChild(metaEl);
            if (task.description) body.appendChild(descEl);
            body.appendChild(footerEl);

            card.appendChild(body);
            return card;
        }
    }

    /**
     * Compute the remaining time from now until a given date string.
     * @param {string} dateStr - String representing a future date.
     * @returns {{label: string, expired: boolean}} Formatted time text and expired flag.
     */
    function getTimeLeftInfo(dateStr) {
        const target = new Date(dateStr);
        if (Number.isNaN(target.getTime())) {
            return { label: "Invalid date", expired: false };
        }

        const now = new Date();
        const diffMs = target - now;

        if (diffMs <= 0) {
            return { label: "expired", expired: true };
        }

        let totalSeconds = Math.floor(diffMs / 1000);

        const days = Math.floor(totalSeconds / (24 * 3600));
        totalSeconds %= (24 * 3600);

        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;

        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        const hh = String(hours).padStart(2, "0");
        const mm = String(minutes).padStart(2, "0");
        const ss = String(seconds).padStart(2, "0");

        let label = "";

        if (days > 0) {
            label = `${days}d ${hh}:${mm}:${ss}`;
        } else {
            label = `${hh}:${mm}:${ss}`;
        }

        return { label, expired: false };
    }

    /**
     * Return the Bootstrap badge class for a given priority level.
     * @param {string} priority - "Low" | "Medium" | "High".
     * @returns {string} CSS class string for the badge.
     */
    function getPriorityBadgeClass(priority) {
        switch (priority) {
            case "Low":
                return "bg-success";
            case "Medium":
                return "bg-warning text-dark";
            case "High":
                return "bg-danger";
            default:
                return "bg-secondary";
        }
    }

    /**
     * Update only the countdown text and expired style for all rendered task cards.
     * This avoids re-rendering the entire DOM tree every tick.
     */
    function tickCountdown() {
        if (!tasksContainerEl) return;

        const allTasks = taskManager.getTasks();
        const cards = tasksContainerEl.querySelectorAll("[data-task-id]");

        cards.forEach(card => {
            const id = Number(card.dataset.taskId);
            const task = allTasks.find(t => t.id === id);
            if (!task) return;

            const { label, expired } = getTimeLeftInfo(task.date);

            const timeEl = card.querySelector(".time-left");
            if (timeEl) {
                timeEl.textContent = label;
            }

            if (expired) {
                card.classList.add("border-danger", "bg-light", "opacity-75");
            } else {
                card.classList.remove("border-danger", "bg-light", "opacity-75");
            }
        });
    }

    /**
     * Cache references to all DOM elements used by the app.
     * This avoids repeated document.querySelector calls.
     */
    function cacheDom() {
        addTaskButtonEl  = document.getElementById("addTaskButton");
        taskModalEl      = document.getElementById("taskModal");
        headerCloseBtnEl = document.getElementById("headerCloseBtn");
        closeButtonEl    = document.getElementById("closeButton");
        saveButtonEl     = document.getElementById("saveButton");
        taskNameEl       = document.getElementById("taskName");
        taskCategoryEl   = document.getElementById("taskCategory");
        priorityInputsEls = document.querySelectorAll("input[name='priority']");
        dueDateEl         = document.getElementById("dueDate");
        taskDescriptionEl = document.getElementById("taskDescription");
        taskNameErrorEl        = document.getElementById("taskNameError");
        taskCategoryErrorEl    = document.getElementById("taskCategoryError");
        priorityErrorEl        = document.getElementById("priorityError");
        dueDateErrorEl         = document.getElementById("dueDateError");
        taskDescriptionErrorEl = document.getElementById("taskDescriptionError");
        taskFormEl             = document.getElementById("taskForm");
        tasksContainerEl       = document.getElementById("tasksContainer");
        categoryFilterEl       = document.getElementById("categoryFilter");
        sortByDateFilterEl     = document.getElementById("sortByDateFilter");
        modalTitleEl           = document.getElementById("modalTitle");
        priorityContainerEl    = document.getElementById("priorityContainer");
    }

    /**
     * Populate the category <select> in the form from the CATEGORIES array.
     */
    function populateCategorySelect() {
        if (!taskCategoryEl) return;

        taskCategoryEl.innerHTML = "";
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "Select category";
        taskCategoryEl.appendChild(emptyOption);

        CATEGORIES.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            taskCategoryEl.appendChild(opt);
        });
    }

    /**
     * Populate the top filter <select> with all categories while keeping
     * the first option ("All categories") untouched.
     */
    function populateCategoryFilter() {
        if (!categoryFilterEl) return;

        categoryFilterEl.length = 1;

        CATEGORIES.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            categoryFilterEl.appendChild(opt);
        });
    }

    /**
     * Dynamically create radio buttons for all priority levels.
     */
    function populatePriorityRadios() {
        if (!priorityContainerEl) return;

        priorityContainerEl.innerHTML = "";

        PRIORITIES.forEach((prio) => {
            const wrapper = document.createElement("div");
            wrapper.className = "form-check form-check-inline";

            const input = document.createElement("input");
            input.type = "radio";
            input.className = "form-check-input";
            input.name = "priority";
            input.id = "priority-" + prio.toLowerCase();
            input.value = prio;

            const label = document.createElement("label");
            label.className = "form-check-label";
            label.htmlFor = input.id;
            label.textContent = prio;

            wrapper.appendChild(input);
            wrapper.appendChild(label);

            priorityContainerEl.appendChild(wrapper);
        });

        priorityInputsEls = priorityContainerEl.querySelectorAll("input[name='priority']");
    }

    /**
     * Create core instances of TaskManager, Modal and TaskRenderer.
     */
    function createInstances() {
        taskManager = new TaskManager();
        taskModalInstance = new bootstrap.Modal(taskModalEl);
        taskRenderer = new TaskRenderer(tasksContainerEl, handleDeleteTask, handleEditTask);
    }

    /**
     * Attach all event listeners needed for user interaction.
     */
    function bindEvents() {
        addTaskButtonEl.addEventListener("click", openModal);
        headerCloseBtnEl.addEventListener("click", closeModal);
        closeButtonEl.addEventListener("click", closeModal);
        saveButtonEl.addEventListener("click", handleSaveClick);

        categoryFilterEl.addEventListener("change", () => {
            taskRenderer.renderTasks(getVisibleTasks());
        });

        sortByDateFilterEl.addEventListener("change", () => {
            taskRenderer.renderTasks(getVisibleTasks());
        });
    }

    /**
     * Open the modal in "New Task" mode and reset the form.
     */
    function openModal() {
        editingTaskId = null;
        taskFormEl.reset();
        clearErrors();
        modalTitleEl.textContent = "New Task";
        saveButtonEl.textContent = "Save";
        taskModalInstance.show();
    }

    /**
     * Close the modal and clear form + error messages.
     */
    function closeModal() {
        taskFormEl.reset();
        clearErrors();
        editingTaskId = null;
        taskModalInstance.hide();
    }

    /**
     * Clear all validation error messages from the form.
     */
    function clearErrors() {
        taskNameErrorEl.textContent = "";
        taskCategoryErrorEl.textContent = "";
        priorityErrorEl.textContent = "";
        dueDateErrorEl.textContent = "";
        taskDescriptionErrorEl.textContent = "";
    }

    /**
     * Start a single global countdown interval if not already running.
     * Uses tickCountdown to update only the countdown text and styles.
     */
    function startCountdown() {
        if (countdownIntervalId !== null) return;

        // initial update
        tickCountdown();

        // update every second (1000ms). Could be changed to 60000 for per-minute updates.
        countdownIntervalId = setInterval(() => {
            tickCountdown();
        }, 1000);
    }

    /**
     * Stop the countdown interval completely if there are no tasks left.
     */
    function stopCountdownIfNoTasks() {
        if (taskManager.getTasks().length === 0 && countdownIntervalId !== null) {
            clearInterval(countdownIntervalId);
            countdownIntervalId = null;
        }
    }

    /**
     * Handle click on the "Save" button:
     * validate form, add or update task, re-render list and start countdown.
     */
    function handleSaveClick() {
        clearErrors();

        const name = taskNameEl.value;
        const category = taskCategoryEl.value;

        let priority = "";
        priorityInputsEls.forEach(p => {
            if (p.checked) priority = p.value;
        });

        const date = dueDateEl.value;
        const description = taskDescriptionEl.value;

        const { isValid, errors } = TaskValidator.validateTask({
            name,
            category,
            priority,
            date,
            description
        });

        if (!isValid) {
            if (errors.name) taskNameErrorEl.textContent = errors.name;
            if (errors.category) taskCategoryErrorEl.textContent = errors.category;
            if (errors.priority) priorityErrorEl.textContent = errors.priority;
            if (errors.date) dueDateErrorEl.textContent = errors.date;
            if (errors.description) taskDescriptionErrorEl.textContent = errors.description;
            return;
        }

        if (editingTaskId !== null) {
            taskManager.updateTask(editingTaskId, {
                name,
                category,
                priority,
                date,
                description
            });
        } else {
            taskManager.addTask(
                name,
                category,
                priority,
                date,
                description
            );
        }

        taskRenderer.renderTasks(getVisibleTasks());
        startCountdown();
        closeModal();
    }

    /**
     * Delete a task by id and refresh the visible list.
     * @param {number} id - Task id to delete.
     */
    function handleDeleteTask(id) {
        taskManager.deleteTask(id);
        taskRenderer.renderTasks(getVisibleTasks());
        stopCountdownIfNoTasks();
    }

    /**
     * Compute the list of tasks currently visible according to
     * category filter and sort direction.
     * @returns {Task[]} Filtered and sorted tasks.
     */
    function getVisibleTasks() {
        const allTasks = taskManager.getTasks();

        const category = categoryFilterEl.value;
        const sortDir = sortByDateFilterEl.value;

        let result = allTasks;

        if (category) {
            result = result.filter(task => task.category === category);
        }

        result = result.slice().sort((a, b) => {
            const da = new Date(a.date);
            const db = new Date(b.date);
            if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return 0;
            if (sortDir === "asc") {
                return da - db;
            } else {
                return db - da;
            }
        });

        return result;
    }

    /**
     * Prepare the form for editing an existing task:
     * fills all fields, sets proper titles and opens the modal.
     * @param {Task} task - Task to edit.
     */
    function handleEditTask(task) {
        editingTaskId = task.id;

        taskNameEl.value     = task.name;
        taskCategoryEl.value = task.category;
        dueDateEl.value      = task.date;
        taskDescriptionEl.value = task.description || "";

        priorityInputsEls.forEach(p => {
            p.checked = (p.value === task.priority);
        });

        modalTitleEl.textContent = "Edit Task";
        saveButtonEl.textContent = "Save Changes";

        clearErrors();
        taskModalInstance.show();
    }

    /**
     * Initialize the whole application:
     * cache DOM, build dynamic controls, create instances and bind events.
     */
    function init() {
        cacheDom();
        populateCategorySelect();
        populatePriorityRadios();
        createInstances();
        bindEvents();
        populateCategoryFilter();
        taskRenderer.renderTasks(getVisibleTasks());
        if (taskManager.getTasks().length > 0) {
            startCountdown();
        }
    }

    return {
        init
    };

})();

/**
 * Start the application once the DOM content is fully loaded.
 */

document.addEventListener("DOMContentLoaded", () => {
    App.init();
});

