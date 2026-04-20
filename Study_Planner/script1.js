/**
 * SMARTPLAN – STUDY PLANNER  |  script.js  (Server Edition)
 * ──────────────────────────────────────────────────────────
 * Storage  : api.php → MySQL via XAMPP (primary & only source)
 * Fallback : NONE – if XAMPP is offline, errors are shown
 * Views    : Dashboard · Calendar · Analytics · Settings
 */

const App = {
    // ── CONFIG ───────────────────────────────────────────────────────────────
    apiUrl       : 'api.php',
    tasks        : [],
    currentFilter: 'all',
    calViewDate  : new Date(),
    editingId    : null,
    _serverOnline: null,      // tracks last known server state
    settings: {
        theme          : 'dark',
        accent         : '#38bdf8',
        defaultPriority: 'Medium',
        userName       : 'Rohan'
    },

    // ── INIT ─────────────────────────────────────────────────────────────────
    init() {
        this.loadSettings();
        this.settings.userName = 'Rohan';
        this.setGreeting();
        this.setupSidebar();
        this.setupModal();
        this.setupFilterTabs();
        this.setupCalendarView();
        this.setupSettings();
        this.setupGlobalListeners();
        this.loadData();
    },

    // ── API HELPER ────────────────────────────────────────────────────────────
    /**
     * Central fetch wrapper. Throws descriptive errors on network/JSON failures
     * so every caller can show a meaningful toast.
     */
    async apiFetch(method, body = null, queryString = '') {
        const url  = this.apiUrl + (queryString ? `?${queryString}` : '');
        const opts = { method, headers: { 'Content-Type': 'application/json' } };
        if (body) opts.body = JSON.stringify(body);

        let res, text;
        try {
            res  = await fetch(url, opts);
            text = await res.text();
        } catch (networkErr) {
            // XAMPP / Apache is not running OR completely unreachable
            this._setServerStatus(false);
            throw new Error('Cannot connect to server. Is XAMPP running?');
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            this._setServerStatus(false);
            throw new Error(`Invalid JSON from server. Check api.php for PHP errors.`);
        }

        if (!res.ok) {
            this._setServerStatus(false);
            throw new Error(data.error || `Server error ${res.status}`);
        }

        this._setServerStatus(true);
        return data;
    },

    // ── SERVER STATUS ─────────────────────────────────────────────────────────
    _setServerStatus(online) {
        this._serverOnline = online;
        const el  = document.getElementById('serverStatus');
        const dot = document.getElementById('serverDot');
        if (!el) return;
        if (online) {
            el.textContent  = 'Connected';
            el.className    = 'status-ok';
            if (dot) { dot.style.background = 'var(--accent-success)'; dot.style.boxShadow = '0 0 8px var(--accent-success)'; }
        } else {
            el.textContent  = 'Offline';
            el.className    = 'status-error';
            if (dot) { dot.style.background = 'var(--accent-danger)'; dot.style.boxShadow = '0 0 8px var(--accent-danger)'; }
        }
    },

    // ── LOAD DATA (GET) ───────────────────────────────────────────────────────
    async loadData() {
        try {
            const data = await this.apiFetch('GET');
            // Normalise every id to STRING so dataset.id comparisons always match
            this.tasks = Array.isArray(data)
                ? data.map(t => ({ ...t, id: String(t.id) }))
                : [];
        } catch (err) {
            this.showToast(`❌ Failed to load tasks: ${err.message}`, 'error');
            this.tasks = [];
        }
        this.renderTasks();
        this.updateStats();
        this.renderMiniCalendar();
        this.updateFocusCard();
        this._updateStoredCount();
    },

    // ── ADD TASK (POST) ───────────────────────────────────────────────────────
    async addTask(taskData) {
        const task = {
            id       : String(Date.now() + Math.floor(Math.random() * 1000)),
            subject  : taskData.subject,
            task_name: taskData.task_name,
            deadline : taskData.deadline,
            priority : taskData.priority,
            status   : 0,
            created  : new Date().toISOString()
        };
        try {
            await this.apiFetch('POST', task);
            await this.loadData();          // re-fetch so IDs are always from DB
            this.showToast('✅ Task added successfully!', 'success');
        } catch (err) {
            this.showToast(`❌ Failed to add task: ${err.message}`, 'error');
        }
    },

    // ── UPDATE TASK (PUT) ─────────────────────────────────────────────────────
    async updateTask(id, patch) {
        try {
            await this.apiFetch('PUT', { id, ...patch });
            await this.loadData();          // re-fetch so edits show instantly
        } catch (err) {
            this.showToast(`❌ Failed to update task: ${err.message}`, 'error');
        }
    },

    // ── DELETE SINGLE TASK (DELETE ?id=) ─────────────────────────────────────
    async deleteTaskById(id) {
        try {
            await this.apiFetch('DELETE', null, `id=${id}`);
            await this.loadData();          // re-fetch: guaranteed to reflect DB
            this.showToast('🗑️ Task deleted', 'info');
        } catch (err) {
            this.showToast(`❌ Failed to delete task: ${err.message}`, 'error');
        }
    },

    // ── TOGGLE COMPLETE (PUT with status) ─────────────────────────────────────
    async toggleTaskStatus(id) {
        // Find the task using string comparison (dataset.id is always a string)
        const task = this.tasks.find(t => String(t.id) === String(id));
        if (!task) return;
        const newStatus   = task.status === 100 ? 0 : 100;
        const completedAt = newStatus === 100 ? new Date().toISOString() : null;
        try {
            await this.apiFetch('PUT', { id, status: newStatus, completedAt });
            if (newStatus === 100) this.recordStreakDay();
            await this.loadData();          // re-fetch so status reflects DB
            this.showToast(newStatus === 100 ? '🎉 Task completed!' : '🔄 Task reopened', 'success');
        } catch (err) {
            this.showToast(`❌ Failed to update status: ${err.message}`, 'error');
        }
    },

    // ── BULK CLEAR COMPLETED (DELETE ?completed=1) ────────────────────────────
    async clearCompleted() {
        const cnt = this.tasks.filter(t => t.status === 100).length;
        if (!cnt) { this.showToast('No completed tasks to clear.', 'info'); return; }
        this.showConfirm('Clear Completed', `Delete ${cnt} completed task(s)?`, async () => {
            try {
                await this.apiFetch('DELETE', null, 'completed=1');
                await this.loadData();
                this.showToast(`✅ Cleared ${cnt} completed tasks.`, 'success');
            } catch (err) {
                this.showToast(`❌ Failed to clear tasks: ${err.message}`, 'error');
            }
        });
    },

    // ── BULK DELETE ALL (DELETE ?all=1) ───────────────────────────────────────
    async deleteAllTasks() {
        if (!this.tasks.length) { this.showToast('No tasks to delete.', 'info'); return; }
        this.showConfirm('Delete All Tasks', `⚠️ Delete ALL ${this.tasks.length} tasks? This cannot be undone!`, async () => {
            try {
                await this.apiFetch('DELETE', null, 'all=1');
                await this.loadData();
                this.showToast('🗑️ All tasks deleted.', 'info');
            } catch (err) {
                this.showToast(`❌ Failed to delete all tasks: ${err.message}`, 'error');
            }
        });
    },

    // ── STREAK (localStorage – personal, not task data) ──────────────────────
    recordStreakDay() {
        const today = new Date().toISOString().slice(0, 10);
        const days  = JSON.parse(localStorage.getItem('smartplan_streak_days') || '[]');
        if (!days.includes(today)) {
            days.push(today);
            localStorage.setItem('smartplan_streak_days', JSON.stringify(days));
        }
    },

    calcStreak() {
        const days = JSON.parse(localStorage.getItem('smartplan_streak_days') || '[]').sort().reverse();
        if (!days.length) return 0;
        let streak = 0;
        let check  = new Date();
        check.setHours(0, 0, 0, 0);
        for (let i = 0; i < 365; i++) {
            const key = check.toISOString().slice(0, 10);
            if (days.includes(key)) { streak++; check.setDate(check.getDate() - 1); }
            else break;
        }
        return streak;
    },

    // ── REFRESH ALL ───────────────────────────────────────────────────────────
    refresh() {
        this.renderTasks();
        this.updateStats();
        this.renderMiniCalendar();
        this.updateFocusCard();
        this._updateStoredCount();
        if (document.getElementById('view-calendar')?.classList.contains('active'))  this.renderFullCalendar();
        if (document.getElementById('view-analytics')?.classList.contains('active')) this.renderAnalytics();
    },

    _updateStoredCount() {
        const el = document.getElementById('storedCount');
        if (el) el.textContent = this.tasks.length;
    },

    // ── GREETING ─────────────────────────────────────────────────────────────
    setGreeting() {
        const h    = new Date().getHours();
        const day  = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
        const greet= h < 12 ? '☀️ Good morning' : h < 17 ? '🌤️ Good afternoon' : '🌙 Good evening';
        const el   = document.getElementById('greetingText');
        if (el) el.textContent = `${greet}, ${this.settings.userName}! · ${day}`;
    },

    // ── SIDEBAR NAV ──────────────────────────────────────────────────────────
    setupSidebar() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                this.switchView(item.dataset.view);
            });
        });
    },

    switchView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`view-${viewName}`);
        if (target) target.classList.add('active');
        if (viewName === 'calendar')  this.renderFullCalendar();
        if (viewName === 'analytics') this.renderAnalytics();
        if (viewName === 'settings')  this.refreshSettingsPanel();
    },

    // ── SORT LOGIC ────────────────────────────────────────────────────────────
    sortTasks(tasks) {
        const now = new Date();
        return [...tasks].sort((a, b) => {
            if (a.status === 100 && b.status !== 100) return 1;
            if (a.status !== 100 && b.status === 100) return -1;
            return this.calcScore(b, now) - this.calcScore(a, now);
        });
    },

    calcScore(task, now) {
        const pVal     = { High: 3, Medium: 2, Low: 1 };
        const priority = pVal[task.priority] || 2;
        const hours    = Math.max(0.1, (new Date(task.deadline) - now) / 3600000);
        return priority + (1 / hours);
    },

    // ── RENDER TASKS ──────────────────────────────────────────────────────────
    renderTasks(filterOverride) {
        const filter = filterOverride || this.currentFilter;
        const list   = document.getElementById('taskList');
        if (!list) return;

        let filtered = this.tasks;
        if (filter === 'pending')   filtered = this.tasks.filter(t => t.status !== 100);
        if (filter === 'completed') filtered = this.tasks.filter(t => t.status === 100);

        const sorted = this.sortTasks(filtered);
        list.innerHTML = '';

        if (!sorted.length) {
            list.innerHTML = `<li class="empty-state">
                <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                    <rect x="9" y="3" width="6" height="4" rx="1"/>
                </svg>
                <p>${filter === 'all' ? 'No tasks yet. Click <strong>Quick Add</strong> to get started!' : `No ${filter} tasks.`}</p>
            </li>`;
            return;
        }
        sorted.forEach(task => this.renderTaskItem(task, list));
    },

    renderTaskItem(task, container) {
        const dateObj   = new Date(task.deadline);
        const now       = new Date();
        const isOverdue = dateObj < now && task.status !== 100;
        const dateStr   = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        + ' · ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const li = document.createElement('li');
        li.className = `task-item ${task.status === 100 ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`;
        li.draggable  = true;
        li.dataset.id = String(task.id);  // always string – matches loadData normalisation

        li.innerHTML = `
            <div class="priority-indicator p-${task.priority}"></div>
            <div class="task-content">
                <div class="task-title">${this.esc(task.task_name)}</div>
                <div class="task-meta">
                    <span class="subject-badge">${this.esc(task.subject)}</span>
                    <span>·</span>
                    <span class="${isOverdue ? 'overdue-text' : ''}">${isOverdue ? '⚠️ Overdue · ' : ''}${dateStr}</span>
                </div>
            </div>
            <div class="task-actions">
                <button class="action-btn btn-check" title="${task.status === 100 ? 'Mark Incomplete' : 'Mark Complete'}">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </button>
                <button class="action-btn btn-edit" title="Edit Task">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </button>
                <button class="action-btn btn-delete" title="Delete Task">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            </div>`;

        this.attachDnD(li);
        container.appendChild(li);
    },

    // ── MINI CALENDAR ─────────────────────────────────────────────────────────
    renderMiniCalendar() {
        const now    = new Date();
        const months = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

        const el = document.getElementById('calendarMonthYear');
        if (el) el.textContent = `${months[now.getMonth()]} ${now.getFullYear()}`;

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const today       = now.getDate();
        const firstDayIdx = new Date(now.getFullYear(), now.getMonth(), 1).getDay();

        const taskDays = new Set();
        this.tasks.forEach(t => {
            const d = new Date(t.deadline);
            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear())
                taskDays.add(d.getDate());
        });

        let html = ['S','M','T','W','T','F','S'].map(d => `<div class="cal-day">${d}</div>`).join('');
        html    += Array(firstDayIdx).fill('<div></div>').join('');

        for (let i = 1; i <= daysInMonth; i++) {
            const cls = ['cal-date',
                i === today     ? 'today'    : '',
                taskDays.has(i) ? 'has-task' : ''
            ].filter(Boolean).join(' ');
            html += `<div class="${cls}">${i}</div>`;
        }

        const calEl = document.getElementById('miniCalendar');
        if (calEl) calEl.innerHTML = html;
    },

    // ── STATS ─────────────────────────────────────────────────────────────────
    updateStats() {
        const total     = this.tasks.length;
        const completed = this.tasks.filter(t => t.status === 100).length;
        const percent   = total === 0 ? 0 : Math.round((completed / total) * 100);

        this.animateCount('totalCount',     total);
        this.animateCount('completedCount', completed);
        this.animateCount('progressText',   percent, '%');

        const bar = document.getElementById('progressBar');
        if (bar) bar.style.width = `${percent}%`;

        const ring  = document.getElementById('ringFill');
        const pctEl = document.getElementById('ringPct');
        if (ring) {
            const circumference = 2 * Math.PI * 40;
            ring.style.strokeDashoffset = circumference - (percent / 100) * circumference;
        }
        if (pctEl) pctEl.textContent = `${percent}%`;

        const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
        const dueToday = this.tasks.filter(t => {
            const d = new Date(t.deadline);
            return t.status !== 100 && d >= new Date() && d <= endOfDay;
        }).length;
        this.animateCount('dueTodayCount', dueToday);
    },

    animateCount(id, targetVal, suffix = '') {
        const el = document.getElementById(id);
        if (!el) return;
        const current = parseInt(el.textContent) || 0;
        const diff    = targetVal - current;
        if (diff === 0) return;
        const steps = 20;
        const step  = diff / steps;
        let i = 0;
        const iv = setInterval(() => {
            i++;
            el.textContent = Math.round(current + step * i) + suffix;
            if (i >= steps) { el.textContent = targetVal + suffix; clearInterval(iv); }
        }, 30);
    },

    // ── FOCUS CARD ────────────────────────────────────────────────────────────
    updateFocusCard() {
        const pending = this.tasks.filter(t => t.status !== 100);
        const setEl   = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

        setEl('focusHighCount', this.tasks.filter(t => t.priority === 'High'   && t.status !== 100).length);
        setEl('focusMedCount',  this.tasks.filter(t => t.priority === 'Medium' && t.status !== 100).length);
        setEl('focusLowCount',  this.tasks.filter(t => t.priority === 'Low'    && t.status !== 100).length);
        setEl('streakCount', this.calcStreak());

        const upcoming  = [...pending]
            .filter(t => new Date(t.deadline) >= new Date())
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        const ndText    = document.getElementById('nextDeadlineText');
        const ndSubject = document.getElementById('nextDeadlineSubject');

        if (upcoming.length && ndText) {
            const next = upcoming[0];
            const diff = Math.ceil((new Date(next.deadline) - new Date()) / 3600000);
            const timeStr = diff < 1 ? 'Less than 1 hour!' : diff < 24 ? `In ${diff} hour${diff > 1 ? 's' : ''}` : `In ${Math.ceil(diff/24)} day${Math.ceil(diff/24) > 1 ? 's' : ''}`;
            ndText.textContent = `${this.esc(next.task_name)} · ${timeStr}`;
            if (ndSubject) ndSubject.textContent = next.subject;
        } else if (ndText) {
            ndText.textContent = 'No upcoming tasks 🎉';
            if (ndSubject) ndSubject.textContent = '';
        }

        const overdue  = this.tasks.filter(t => new Date(t.deadline) < new Date() && t.status !== 100);
        const alertEl  = document.getElementById('overdueAlert');
        const alertTx  = document.getElementById('overdueAlertText');
        if (alertEl) {
            if (overdue.length) {
                alertEl.style.display = 'flex';
                if (alertTx) alertTx.textContent = `${overdue.length} task${overdue.length > 1 ? 's' : ''} overdue!`;
            } else {
                alertEl.style.display = 'none';
            }
        }
    },

    // ── MODAL (ADD / EDIT) ────────────────────────────────────────────────────
    setupModal() {
        const modal    = document.getElementById('addModal');
        const form     = document.getElementById('addTaskForm');
        const openBtns = ['openModalBtn','openModalBtnCal'].map(id => document.getElementById(id));

        openBtns.forEach(b => b?.addEventListener('click', () => this.openModal()));
        document.getElementById('closeModalBtn')?.addEventListener('click', () => this.closeModal());
        document.getElementById('closeModalX')  ?.addEventListener('click', () => this.closeModal());
        modal?.addEventListener('click', e => { if (e.target === modal) this.closeModal(); });

        form?.addEventListener('submit', async e => {
            e.preventDefault();
            const id   = document.getElementById('editTaskId')?.value; // string or ''
            const data = {
                subject  : document.getElementById('subjectInput').value.trim(),
                task_name: document.getElementById('taskTitleInput').value.trim(),
                deadline : document.getElementById('deadlineInput').value,
                priority : document.getElementById('priorityInput').value
            };
            if (!data.subject || !data.task_name || !data.deadline) {
                this.showToast('⚠️ Please fill in all fields', 'error'); return;
            }
            if (id) {
                await this.updateTask(id, data);  // id is already a string
                this.showToast('✏️ Task updated!', 'success');
            } else {
                await this.addTask(data);
            }
            this.closeModal();
        });
    },

    openModal(taskId = null) {
        const modal     = document.getElementById('addModal');
        const form      = document.getElementById('addTaskForm');
        const titleEl   = document.getElementById('modalTitle');
        const submitBtn = document.getElementById('submitTaskBtn');
        const editIdEl  = document.getElementById('editTaskId');

        form.reset();
        this.editingId = taskId;

        if (taskId) {
            // Use string comparison – IDs are normalised to strings after loadData()
            const task = this.tasks.find(t => String(t.id) === String(taskId));
            if (!task) return;
            if (titleEl)  titleEl.textContent  = 'Edit Task';
            if (submitBtn) submitBtn.innerHTML  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17 4 12"/></svg> Save Changes`;
            if (editIdEl) editIdEl.value        = String(taskId);
            document.getElementById('subjectInput').value   = task.subject;
            document.getElementById('taskTitleInput').value = task.task_name;
            document.getElementById('deadlineInput').value  = (task.deadline || '').slice(0, 16);
            document.getElementById('priorityInput').value  = task.priority;
        } else {
            if (titleEl)   titleEl.textContent = 'Add New Task';
            if (submitBtn) submitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Task`;
            if (editIdEl)  editIdEl.value      = '';
            const defPri = document.getElementById('defaultPrioritySetting')?.value || this.settings.defaultPriority;
            document.getElementById('priorityInput').value  = defPri;
        }

        modal?.classList.add('active');
    },

    closeModal() {
        document.getElementById('addModal')?.classList.remove('active');
        document.getElementById('addTaskForm')?.reset();
        this.editingId = null;
    },

    // ── FILTER TABS ───────────────────────────────────────────────────────────
    setupFilterTabs() {
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentFilter = btn.dataset.filter;
                this.renderTasks();
            });
        });
    },

    // ── GLOBAL TASK LIST DELEGATION ───────────────────────────────────────────
    setupGlobalListeners() {
        document.body.addEventListener('click', e => {
            const btn = e.target.closest('button.action-btn');
            if (!btn) return;
            const li = btn.closest('.task-item');
            if (!li) return;
            // Keep ID as a STRING – dataset always stores strings, and all
            // task.id values are normalised to strings in loadData()
            const id = li.dataset.id;
            if (!id) return;

            if (btn.classList.contains('btn-check'))  this.toggleTaskStatus(id);
            if (btn.classList.contains('btn-edit'))   this.openModal(id);
            if (btn.classList.contains('btn-delete')) {
                this.showConfirm('Delete Task', 'Are you sure you want to permanently delete this task?',
                    () => this.deleteTaskById(id));
            }
        });

        const list = document.getElementById('taskList');
        list?.addEventListener('dragover', e => {
            e.preventDefault();
            const afterEl  = this.getDragAfterElement(list, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (!dragging) return;
            if (afterEl == null) list.appendChild(dragging);
            else list.insertBefore(dragging, afterEl);
        });
    },

    // ── DRAG AND DROP ─────────────────────────────────────────────────────────
    attachDnD(item) {
        item.addEventListener('dragstart', () => item.classList.add('dragging'));
        item.addEventListener('dragend',   () => {
            item.classList.remove('dragging');
            // Re-order local array to match DOM (IDs are strings)
            const newOrder = [...document.querySelectorAll('#taskList .task-item')].map(el => el.dataset.id);
            this.tasks.sort((a, b) => {
                const ai = newOrder.indexOf(String(a.id)), bi = newOrder.indexOf(String(b.id));
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });
        });
    },

    getDragAfterElement(container, y) {
        const items = [...container.querySelectorAll('.task-item:not(.dragging)')];
        return items.reduce((closest, child) => {
            const box    = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    // ── FULL CALENDAR VIEW ────────────────────────────────────────────────────
    setupCalendarView() {
        document.getElementById('calPrev')?.addEventListener('click', () => {
            this.calViewDate.setMonth(this.calViewDate.getMonth() - 1);
            this.renderFullCalendar();
        });
        document.getElementById('calNext')?.addEventListener('click', () => {
            this.calViewDate.setMonth(this.calViewDate.getMonth() + 1);
            this.renderFullCalendar();
        });
    },

    renderFullCalendar() {
        const d      = this.calViewDate;
        const months = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

        const elLabel = document.getElementById('fullCalMonthYear');
        if (elLabel) elLabel.textContent = `${months[d.getMonth()]} ${d.getFullYear()}`;

        const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        const firstDayIdx = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
        const today       = new Date();

        const tasksByDay = {};
        this.tasks.forEach(t => {
            const td = new Date(t.deadline);
            if (td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear()) {
                const key = td.getDate();
                if (!tasksByDay[key]) tasksByDay[key] = [];
                tasksByDay[key].push(t);
            }
        });

        const grid = document.getElementById('fullCalendar');
        if (!grid) return;

        let html = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
            .map(day => `<div class="fc-header">${day}</div>`).join('');
        html += Array(firstDayIdx).fill('<div class="fc-cell empty"></div>').join('');

        for (let i = 1; i <= daysInMonth; i++) {
            const isToday  = (i === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear());
            const dayTasks = tasksByDay[i] || [];
            const taskDots = dayTasks.slice(0, 3)
                .map(t => `<div class="fc-dot p-${t.priority}" title="${this.esc(t.task_name)}"></div>`)
                .join('');

            html += `<div class="fc-cell ${isToday ? 'fc-today' : ''} ${dayTasks.length ? 'fc-has-tasks' : ''}" data-day="${i}">
                <div class="fc-date">${i}</div>
                <div class="fc-dots">${taskDots}</div>
                ${dayTasks.length > 3 ? `<div class="fc-more">+${dayTasks.length - 3} more</div>` : ''}
            </div>`;
        }

        grid.innerHTML = html;

        grid.querySelectorAll('.fc-cell:not(.empty)').forEach(cell => {
            cell.addEventListener('click', () => {
                grid.querySelectorAll('.fc-cell').forEach(c => c.style.outline = '');
                cell.style.outline = `2px solid var(--accent-primary)`;
                this.showCalDayTasks(parseInt(cell.dataset.day), tasksByDay[parseInt(cell.dataset.day)] || []);
            });
        });
    },

    showCalDayTasks(day, dayTasks) {
        const panel  = document.getElementById('calDayTasks');
        const title  = document.getElementById('calDayTitle');
        const list   = document.getElementById('calDayTaskList');
        const d      = this.calViewDate;
        const months = ["January","February","March","April","May","June",
                        "July","August","September","October","November","December"];

        if (title) title.textContent = `Tasks for ${months[d.getMonth()]} ${day}`;
        if (list)  list.innerHTML    = '';
        if (panel) panel.style.display = 'block';

        if (!dayTasks.length) {
            if (list) list.innerHTML = '<li class="empty-state"><p>No tasks for this day. 🎉</p></li>';
            return;
        }
        dayTasks.forEach(t => this.renderTaskItem(t, list));
        panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // ── ANALYTICS VIEW ────────────────────────────────────────────────────────
    renderAnalytics() {
        const tasks     = this.tasks;
        const total     = tasks.length;
        const completed = tasks.filter(t => t.status === 100).length;
        const percent   = total === 0 ? 0 : Math.round((completed / total) * 100);

        const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
        setEl('ana-completion', `${percent}%`);
        const bar = document.getElementById('ana-progress-bar');
        if (bar) bar.style.width = `${percent}%`;

        const high   = tasks.filter(t => t.priority === 'High').length;
        const medium = tasks.filter(t => t.priority === 'Medium').length;
        const low    = tasks.filter(t => t.priority === 'Low').length;
        setEl('ana-high',   high);
        setEl('ana-medium', medium);
        setEl('ana-low',    low);

        const chartEl = document.getElementById('priorityChart');
        if (chartEl) {
            const max = Math.max(high, medium, low, 1);
            chartEl.innerHTML = [
                this.barRow('High',   high,   max, 'var(--accent-danger)'),
                this.barRow('Medium', medium, max, 'var(--accent-warning)'),
                this.barRow('Low',    low,    max, 'var(--accent-success)')
            ].join('');
        }

        const subjects = {};
        tasks.forEach(t => { subjects[t.subject] = (subjects[t.subject] || 0) + 1; });
        const subEl = document.getElementById('subjectChart');
        if (subEl) {
            subEl.innerHTML = Object.entries(subjects).length
                ? Object.entries(subjects).sort((a, b) => b[1] - a[1])
                    .map(([sub, cnt]) => `
                        <div class="subject-row">
                            <div class="subject-name">${this.esc(sub)}</div>
                            <div class="subject-bar-wrap">
                                <div class="subject-bar-fill" style="width:${total ? (cnt/total*100).toFixed(0) : 0}%; background:var(--accent-primary)"></div>
                            </div>
                            <div class="subject-count">${cnt}</div>
                        </div>`).join('')
                : '<p class="text-muted" style="text-align:center;padding:1rem">No tasks yet</p>';
        }

        const now  = new Date();
        const in7  = new Date(); in7.setDate(in7.getDate() + 7);
        const upcoming = tasks
            .filter(t => { const d = new Date(t.deadline); return t.status !== 100 && d >= now && d <= in7; })
            .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        const upEl = document.getElementById('upcomingList');
        if (upEl) {
            upEl.innerHTML = '';
            if (!upcoming.length) {
                upEl.innerHTML = '<li class="empty-state"><p>No tasks due in the next 7 days. 🎉</p></li>';
            } else {
                upcoming.forEach(t => this.renderTaskItem(t, upEl));
            }
        }
    },

    barRow(label, val, max, color) {
        const pct = max === 0 ? 0 : (val / max * 100).toFixed(0);
        return `<div class="bar-row">
            <div class="bar-label">${label}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${pct}%; background:${color}; transition: width 0.9s ease;"></div>
            </div>
            <div class="bar-val">${val}</div>
        </div>`;
    },

    // ── SETTINGS VIEW ─────────────────────────────────────────────────────────
    setupSettings() {
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', function() {
            this.classList.toggle('on');
            const isLight = this.classList.contains('on');
            document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
            App.settings.theme = isLight ? 'light' : 'dark';
            App.saveSettings();
        });

        // Color swatches
        document.querySelectorAll('.swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
                swatch.classList.add('active');
                const color = swatch.dataset.color;
                document.documentElement.style.setProperty('--accent-primary', color);
                document.documentElement.style.setProperty('--accent-glow',    color + '66');
                App.settings.accent = color;
                App.saveSettings();
            });
        });

        // Default priority
        document.getElementById('defaultPrioritySetting')?.addEventListener('change', function() {
            App.settings.defaultPriority = this.value;
            App.saveSettings();
        });

        // Save name
        document.getElementById('saveNameBtn')?.addEventListener('click', () => {
            const name = document.getElementById('userNameInput')?.value.trim();
            if (!name) { this.showToast('⚠️ Please enter a name', 'error'); return; }
            this.settings.userName = name;
            this.saveSettings();
            document.getElementById('userNameDisplay').textContent  = name;
            document.getElementById('userAvatarInitial').textContent = name[0].toUpperCase();
            this.setGreeting();
            this.showToast('✅ Name saved!', 'success');
        });

        // Clear completed → API bulk delete
        document.getElementById('clearCompletedBtn')?.addEventListener('click', () => this.clearCompleted());

        // Delete all → API bulk delete
        document.getElementById('deleteAllBtn')?.addEventListener('click', () => this.deleteAllTasks());

        // Export (download tasks as JSON)
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this.tasks, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `smartplan_tasks_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('📦 Tasks exported!', 'success');
        });

        // Import (upload JSON → POST each task to API)
        document.getElementById('importFile')?.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async evt => {
                try {
                    const imported = JSON.parse(evt.target.result);
                    if (!Array.isArray(imported)) throw new Error('Invalid format');
                    let added = 0;
                    for (const t of imported) {
                        try {
                            const task = {
                                id       : t.id || (Date.now() + Math.floor(Math.random() * 1000)),
                                subject  : t.subject   || '',
                                task_name: t.task_name || '',
                                deadline : t.deadline  || null,
                                priority : t.priority  || 'Medium',
                                status   : t.status    ?? 0,
                                created  : t.created   || new Date().toISOString(),
                                completedAt: t.completedAt || null
                            };
                            await this.apiFetch('POST', task);
                            this.tasks.unshift(task);
                            added++;
                        } catch { /* skip failed rows */ }
                    }
                    this.refresh();
                    this.showToast(`✅ Imported ${added} tasks!`, 'success');
                } catch {
                    this.showToast('❌ Invalid JSON file', 'error');
                }
                e.target.value = '';
            };
            reader.readAsText(file);
        });

        // Refresh server status button
        document.getElementById('refreshStatusBtn')?.addEventListener('click', async () => {
            const el = document.getElementById('serverStatus');
            if (el) { el.textContent = 'Checking…'; el.className = 'status-checking'; }
            try {
                await this.apiFetch('GET');
                this.showToast('✅ Server is online!', 'success');
            } catch {
                this.showToast('❌ Server is offline. Start XAMPP.', 'error');
            }
        });
    },

    refreshSettingsPanel() {
        this._updateStoredCount();
        const nameInput = document.getElementById('userNameInput');
        if (nameInput) nameInput.value = this.settings.userName;
    },

    // ── CONFIRM DIALOG ────────────────────────────────────────────────────────
    showConfirm(title, message, onConfirm) {
        const modal     = document.getElementById('confirmModal');
        const titleEl   = document.getElementById('confirmTitle');
        const msgEl     = document.getElementById('confirmMessage');
        const okBtn     = document.getElementById('confirmOk');
        const cancelBtn = document.getElementById('confirmCancel');

        if (titleEl) titleEl.textContent = title;
        if (msgEl)   msgEl.textContent   = message;
        modal?.classList.add('active');

        const close = () => modal?.classList.remove('active');

        const newOk = okBtn.cloneNode(true);
        okBtn.parentNode.replaceChild(newOk, okBtn);
        newOk.addEventListener('click', () => { close(); onConfirm(); });

        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', close);

        modal?.addEventListener('click', e => { if (e.target === modal) close(); }, { once: true });
    },

    // ── SETTINGS PERSISTENCE (localStorage – not tasks) ───────────────────────
    saveSettings() {
        try { localStorage.setItem('smartplan_settings', JSON.stringify(this.settings)); } catch {}
    },

    loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem('smartplan_settings') || '{}');
            Object.assign(this.settings, saved);

            if (this.settings.theme === 'light') {
                document.documentElement.setAttribute('data-theme', 'light');
                document.getElementById('themeToggle')?.classList.add('on');
            }
            if (this.settings.accent) {
                document.documentElement.style.setProperty('--accent-primary', this.settings.accent);
                document.documentElement.style.setProperty('--accent-glow', this.settings.accent + '66');
                document.querySelectorAll('.swatch').forEach(s =>
                    s.classList.toggle('active', s.dataset.color === this.settings.accent)
                );
            }
            const defPri = document.getElementById('defaultPrioritySetting');
            if (defPri && this.settings.defaultPriority) defPri.value = this.settings.defaultPriority;

            if (this.settings.userName) {
                const el = document.getElementById('userNameDisplay');
                const av = document.getElementById('userAvatarInitial');
                if (el) el.textContent = this.settings.userName;
                if (av) av.textContent = this.settings.userName[0].toUpperCase();
            }
        } catch {}
    },

    // ── TOAST ─────────────────────────────────────────────────────────────────
    showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast     = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity   = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 400);
        }, 3500);
    },

    // ── XSS ESCAPE ────────────────────────────────────────────────────────────
    esc(text) {
        if (!text) return '';
        const map = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' };
        return String(text).replace(/[&<>"']/g, m => map[m]);
    }
};

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
