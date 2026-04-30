import { getState, getUI, getLastSavedAt, setState } from '../state.js';
import { escapeHtml, formatDateShort, formatDateFull, todayStr, getCurrentSlotIndex, getCurrentSession, timeAgo, generateId, getDayOfWeek, getDayName } from '../utils.js';
import { resolveAssignment, resolveActivity, getGroupStaff, getGroupsForDay, getActiveSlots, getRoomColor, getBTGroupForSession, getStaffGroups } from '../data.js';

export function renderGrid(container, { onSwitchSession, onChangeDate, onCellClick, onAdminClick, onSettingsClick, onAutoAssign, onSwitchRole, isAdminMode, isBTViewing = false }) {
    const state = getState();
    const ui = getUI();
    const slots = getActiveSlots(state, ui.currentSession);
    const activeSlotIdx = getCurrentSlotIndex(slots);
    const activeSession = getCurrentSession(state.settings.sessions);
    const isToday = ui.currentDate === todayStr();
    const lastSaved = getLastSavedAt();

    const prevMain = container.querySelector('.main-content');
    const prevGridWrap = container.querySelector('.grid-wrap');
    const savedMainScroll = prevMain ? prevMain.scrollTop : 0;
    const savedGridWrapScroll = prevGridWrap ? prevGridWrap.scrollTop : 0;
    const savedWindowScroll = window.scrollY;
    const savedDocScroll = document.documentElement.scrollTop || document.body.scrollTop;

    console.log('[renderGrid] Saved scroll:', { savedMainScroll, savedGridWrapScroll, savedWindowScroll, savedDocScroll });

    container.innerHTML = `
        <header class="app-header">
            <div class="header-logo">Pacific<span>Clinics</span></div>
            <div class="session-tabs">
                ${['AM','MD','PM'].map(s => `
                    <button class="tab-btn ${ui.currentSession === s ? 'active' : ''} ${activeSession === s && s !== ui.currentSession ? 'active-now' : ''}" data-session="${s}">${s}</button>
                `).join('')}
            </div>
            <div class="header-spacer"></div>
            ${isAdminMode ? `<span class="editing-badge"><span class="editing-dot"></span>Editing</span>` : ''}
            ${isAdminMode && lastSaved ? `<span class="header-saved${(Date.now() - lastSaved) < 3000 ? ' fresh' : ''}" id="saved-indicator">Saved ${timeAgo(lastSaved)}</span>` : ''}
            ${!isBTViewing ? `
                <button class="btn btn-ghost" id="find-person-btn" style="font-size:12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    Find person
                </button>
            ` : ''}
            <div class="date-nav">
                <button class="btn-icon" id="prev-day" aria-label="Previous day">
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span class="date-label">${isToday ? 'Today' : formatDateShort(ui.currentDate)}</span>
                <button class="btn-icon" id="next-day" aria-label="Next day">
                    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
            <div class="divider"></div>
            <button class="btn btn-ghost" id="theme-toggle" aria-label="Toggle theme" title="Toggle theme">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
            ${!isBTViewing ? `
                <button class="btn ${isAdminMode ? 'btn-secondary' : 'btn-ghost'}" id="admin-btn" style="${isAdminMode ? 'border-color:var(--accent-warm);color:var(--accent-warm)' : ''}">
                    ${isAdminMode
                        ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5"/></svg> Done Editing`
                        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Admin`
                    }
                </button>
            ` : ''}
            <button class="btn btn-ghost" id="switch-role-btn" title="${isBTViewing ? 'Back to my schedule' : 'Switch role'}" style="color:var(--text-3)">
                ${isBTViewing
                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> My schedule`
                    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`
                }
            </button>
        </header>

        ${isAdminMode && !isBTViewing ? `
        <div class="admin-toolbar visible">
            <button class="btn btn-ghost" id="manage-groups-btn" style="font-size:12px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="14" x2="12" y2="18"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
                Add ${getDayName(getDayOfWeek(ui.currentDate))} ${ui.currentSession} Group
            </button>
            <div class="toolbar-sep"></div>
            <button class="btn btn-ghost" id="settings-btn" style="font-size:12px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Settings
            </button>
            ${state.settings.extras?.autoAssign ? `
            <div class="toolbar-sep"></div>
            <button class="btn btn-ghost" id="auto-assign-btn" style="font-size:12px;color:var(--accent);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Auto-assign
            </button>
            ` : ''}
        </div>
        ` : ''}

        <div class="main-content">
            <div class="grid-wrap">
                ${renderGridTable(state, ui, slots, activeSlotIdx, isToday, activeSession, isAdminMode, isBTViewing)}
            </div>
        </div>

        ${!isBTViewing ? `
        <div class="lookup-backdrop" id="lookup-backdrop"></div>
        <div class="lookup-panel" id="lookup-panel">
            <div class="lookup-header">
                <div class="lookup-search-wrap">
                    <svg class="lookup-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input type="text" id="lookup-input" class="lookup-input" placeholder="Search staff or clients…" autocomplete="off" spellcheck="false" />
                </div>
                <button class="btn-icon lookup-close-btn" id="lookup-close">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div id="lookup-body" class="lookup-body">
                <p class="lookup-hint">Search for a staff member or client to see their schedule for ${escapeHtml(isToday ? 'today' : formatDateShort(ui.currentDate))}.</p>
            </div>
        </div>
        ` : ''}
    `;

    // Restore scroll position after re-render with rAF to ensure layout is complete
    requestAnimationFrame(() => {
        const newMain = container.querySelector('.main-content');
        const newGridWrap = container.querySelector('.grid-wrap');

        console.log('[renderGrid] Restoring scroll:', { newMain: !!newMain, newGridWrap: !!newGridWrap, savedMainScroll, savedGridWrapScroll, savedWindowScroll, savedDocScroll });

        if (newMain && savedMainScroll > 0) {
            newMain.scrollTop = savedMainScroll;
            console.log('[renderGrid] Set .main-content.scrollTop to', savedMainScroll);
        }
        if (newGridWrap && savedGridWrapScroll > 0) {
            newGridWrap.scrollTop = savedGridWrapScroll;
            console.log('[renderGrid] Set .grid-wrap.scrollTop to', savedGridWrapScroll);
        }

        if (savedWindowScroll > 0) {
            window.scrollTo(0, savedWindowScroll);
            console.log('[renderGrid] Called window.scrollTo(0,' + savedWindowScroll + ')');
        }
        if (savedDocScroll > 0) {
            document.documentElement.scrollTop = savedDocScroll;
            document.body.scrollTop = savedDocScroll;
            console.log('[renderGrid] Set document scroll to', savedDocScroll);
        }
    });

    // Event wiring
    container.querySelector('.session-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (btn) onSwitchSession(btn.dataset.session);
    });
    container.querySelector('#prev-day').addEventListener('click', () => onChangeDate(-1));
    container.querySelector('#next-day').addEventListener('click', () => onChangeDate(1));
    container.querySelector('#admin-btn')?.addEventListener('click', () => onAdminClick());
    container.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
    container.querySelector('#switch-role-btn').addEventListener('click', onSwitchRole);

    if (!isBTViewing) {
        const findBtn = container.querySelector('#find-person-btn');
        if (findBtn) {
            const lookup = setupLookupPanel(container, ui);
            findBtn.addEventListener('click', () => lookup.open());
        }
    }

    if (isAdminMode) {
        container.querySelector('#settings-btn')?.addEventListener('click', onSettingsClick);
        container.querySelector('#auto-assign-btn')?.addEventListener('click', () => onAutoAssign?.());
        container.querySelector('#manage-groups-btn')?.addEventListener('click', e => {
            const btn = e.currentTarget;
            const ui = getUI();
            const session = ui.currentSession;
            const dayOfWeek = getDayOfWeek(ui.currentDate);
            const dayName = getDayName(dayOfWeek);
            showInlineInput(btn, `${dayName} ${session} group name…`, (name) => {
                if (!name) return;
                setState({ ...getState(), groups: [...getState().groups, { id: generateId(), name, session, dayOfWeek }] });
            }, false);
        });

        // Inline group/staff/client management
        const gridWrap = container.querySelector('.grid-wrap');
        if (gridWrap) {
            gridWrap.addEventListener('click', e => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                e.stopPropagation();
                handleInlineAction(btn.dataset.action, btn.dataset, onCellClick);
            });
        }
    }

    // Delegated click on grid cells
    const grid = container.querySelector('.schedule-grid');
    if (grid) {
        grid.addEventListener('click', e => {
            const cell = e.target.closest('.grid-cell[data-group-id]');
            if (!cell) return;
            const groupId = cell.dataset.groupId;
            const slotIndex = parseInt(cell.dataset.slotIndex, 10);

            // Activity editing for BTs and supervisors
            if (cell.dataset.activityEditable === 'true' && (e.target.classList.contains('activity-text') || e.target.classList.contains('activity-text-empty'))) {
                e.stopPropagation();
                showActivityEditor(cell, groupId, slotIndex);
                return;
            }

            // Room assignment (admin only)
            if (isAdminMode) {
                onCellClick(cell, groupId, slotIndex);
            }
        });

        // Crosshair hover via delegated events
        grid.addEventListener('mouseover', e => {
            const cell = e.target.closest('.grid-cell[data-group-id]');
            if (!cell) return;
            const slotIndex = cell.dataset.slotIndex;
            const groupId = cell.dataset.groupId;
            grid.querySelectorAll(`.grid-th[data-slot="${slotIndex}"]`).forEach(h => h.classList.add('col-hover'));
            grid.querySelectorAll(`.grid-row-label[data-group-id="${groupId}"]`).forEach(l => l.classList.add('row-hover'));
        });
        grid.addEventListener('mouseout', e => {
            const cell = e.target.closest('.grid-cell[data-group-id]');
            if (!cell) return;
            grid.querySelectorAll('.col-hover').forEach(el => el.classList.remove('col-hover'));
            grid.querySelectorAll('.row-hover').forEach(el => el.classList.remove('row-hover'));
        });
    }

    // Tick the "saved X ago" indicator
    if (isAdminMode) {
        startSavedTicker(container);
    }
}

function renderGridTable(state, ui, slots, activeSlotIdx, isToday, activeSession, isAdminMode, isBTViewing = false) {
    const dow = getDayOfWeek(ui.currentDate);
    const sessionGroups = getGroupsForDay(state, ui.currentSession, dow);

    if (sessionGroups.length === 0) {
        return `
            <div class="schedule-grid" style="grid-template-columns:1fr;">
                <div class="empty-grid">
                    <div class="empty-grid-icon">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <h3>No ${getDayName(dow)} ${ui.currentSession} groups</h3>
                    <p>${isAdminMode ? `Click "+ Add Group" above to add a group to ${getDayName(dow)} ${ui.currentSession}.` : `No groups are scheduled for ${getDayName(dow)} ${ui.currentSession}.`}</p>
                </div>
            </div>
        `;
    }

    const colTemplate = `${isAdminMode ? '260px' : '220px'} repeat(${slots.length}, minmax(110px, 1fr))`;

    let html = `<div class="schedule-grid" style="grid-template-columns:${colTemplate};">`;

    // Header row
    html += `<div class="grid-corner">Group / Staff</div>`;
    slots.forEach((slot, i) => {
        const isNow = isToday && i === activeSlotIdx;
        const [time, end] = slot.split(' - ');
        html += `<div class="grid-th ${isNow ? 'col-now' : ''}" data-slot="${i}">
            <span>${escapeHtml(time)}</span>
            <span style="opacity:0.6;font-size:10px;">${escapeHtml(end)}</span>
        </div>`;
    });

    // Group rows — only those belonging to this session
    sessionGroups.forEach(group => {
        const groupStaff = getGroupStaff(state, group.id);
        const groupClients = state.clients.filter(c => c.groupId === group.id);

        if (isAdminMode) {
            html += `
                <div class="grid-row-label grid-row-label--admin" data-group-id="${escapeHtml(group.id)}">
                    <div class="group-label-row">
                        <div class="group-label">
                            <div class="group-label-dot" style="background:var(--accent)"></div>
                            <span class="group-label-name">${escapeHtml(group.name)}</span>
                        </div>
                        <div class="group-label-actions">
                            <button class="inline-action-btn accent" data-action="add-staff" data-group-id="${escapeHtml(group.id)}" title="Add staff">
                                <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                            </button>
                            <button class="inline-action-btn danger" data-action="remove-group" data-id="${escapeHtml(group.id)}" title="Remove group">
                                <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                            </button>
                        </div>
                    </div>
                    <div class="staff-admin-list">
                        ${groupStaff.length === 0
                            ? `<p class="staff-empty-hint">No staff assigned</p>`
                            : groupStaff.map(st => {
                                const link = (state.staffGroupLinks ?? []).find(l => l.staffId === st.id && l.groupId === group.id);
                                const staffClients = state.clients.filter(c => c.staffId === st.id && c.groupId === group.id);
                                return `
                                    <div class="staff-admin-row">
                                        <div class="staff-admin-header">
                                            <svg class="staff-row-icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                            <span class="staff-admin-name">${escapeHtml(st.name)}</span>
                                            <div class="staff-admin-actions">
                                                <button class="inline-action-btn accent" data-action="add-client" data-staff-id="${escapeHtml(st.id)}" data-group-id="${escapeHtml(group.id)}" title="Add client">
                                                    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                                                </button>
                                                <button class="inline-action-btn danger" data-action="remove-staff" data-link-id="${escapeHtml(link?.id ?? '')}" title="Remove from group">
                                                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                        ${staffClients.length > 0 ? `
                                            <ul class="client-admin-list">
                                                ${staffClients.map(c => `
                                                    <li class="client-admin-item">
                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                                        <span>${escapeHtml(c.name)}</span>
                                                        <button class="inline-action-btn danger tiny" data-action="remove-client" data-id="${escapeHtml(c.id)}" title="Remove client">
                                                            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                                        </button>
                                                    </li>
                                                `).join('')}
                                            </ul>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')
                        }
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="grid-row-label" data-group-id="${escapeHtml(group.id)}">
                    <div class="group-label">
                        <div class="group-label-dot" style="background:var(--accent)"></div>
                        <span>${escapeHtml(group.name)}</span>
                    </div>
                    <div class="staff-chips">
                        ${groupStaff.map(s => `<span class="staff-chip">${escapeHtml(s.name)}</span>`).join('')}
                    </div>
                </div>
            `;
        }

        slots.forEach((_, slotIndex) => {
            const assignment = resolveAssignment(state, group.id, ui.currentDate, ui.currentSession, slotIndex);
            const activity = resolveActivity(state, group.id, ui.currentDate, ui.currentSession, slotIndex);
            const isNow = isToday && slotIndex === activeSlotIdx;
            // Activity editing: BTs only, and only for groups they are assigned to
            const isAssignedToGroup = ui.staffId ? (state.staffGroupLinks ?? []).some(l => l.staffId === ui.staffId && l.groupId === group.id) : false;
            const canEditActivity = isAssignedToGroup;

            html += `<div class="grid-cell ${isNow ? 'col-now-cell' : ''} ${isAdminMode ? 'admin-hover' : ''}" data-group-id="${escapeHtml(group.id)}" data-slot-index="${slotIndex}" ${canEditActivity ? 'data-activity-editable="true"' : ''}>`;

            if (assignment) {
                const color = getRoomColor(assignment.roomName);
                html += `
                    <div class="room-pill" style="background:${color}1a;border-left-color:${color};">
                        <span class="room-pill-name" style="color:${color};">${escapeHtml(assignment.roomName)}</span>
                    </div>
                `;
            } else if (isAdminMode) {
                html += `<div class="cell-empty-hint">+</div>`;
            }

            if (activity) {
                html += `<div class="activity-text ${canEditActivity ? '' : 'readonly'}" title="${escapeHtml(activity)}">${escapeHtml(activity)}</div>`;
            } else if (canEditActivity) {
                html += `<div class="activity-text-empty" title="Click to add activity">+ activity</div>`;
            }

            html += `</div>`;
        });
    });

    html += `</div>`;
    return html;
}

// ===== Inline group/staff/client actions =====
function handleInlineAction(action, dataset) {
    const s = getState();

    if (action === 'remove-group') {
        const id = dataset.id;
        if (!confirm(`Remove this group?`)) return;
        setState({
            groups: s.groups.filter(g => g.id !== id),
            staffGroupLinks: (s.staffGroupLinks ?? []).filter(l => l.groupId !== id),
            clients: s.clients.filter(c => c.groupId !== id),
            masterAssignments: s.masterAssignments.filter(a => a.groupId !== id),
            overrides: s.overrides.filter(o => o.groupId !== id),
        });
        return;
    }

    if (action === 'add-staff') {
        const groupId = dataset.groupId;
        const btn = document.querySelector(`[data-action="add-staff"][data-group-id="${groupId}"]`);
        if (!btn) return;
        showStaffInlineInput(btn, groupId);
        return;
    }

    if (action === 'remove-staff') {
        // Remove link between this staff member and the group (don't delete the staff)
        const linkId = dataset.linkId;
        setState({ staffGroupLinks: (s.staffGroupLinks ?? []).filter(l => l.id !== linkId) });
        return;
    }

    if (action === 'add-client') {
        const staffId = dataset.staffId;
        const groupId = dataset.groupId;
        const btn = document.querySelector(`[data-action="add-client"][data-staff-id="${staffId}"]`);
        if (!btn) return;
        showInlineInput(btn, 'Client name…', (name) => {
            if (!name) return;
            setState({ clients: [...getState().clients, { id: generateId(), name, staffId, groupId }] });
        }, false);
        return;
    }

    if (action === 'remove-client') {
        const id = dataset.id;
        setState({ clients: s.clients.filter(c => c.id !== id) });
        return;
    }
}

// Staff inline add with autocomplete — suggests existing staff, allows creating new
function showStaffInlineInput(anchor, groupId) {
    const form = document.createElement('div');
    form.className = 'inline-add-form';
    form.innerHTML = `
        <input class="inline-add-input" type="text" placeholder="Staff name…" autocomplete="off" style="flex:1;min-width:0;" />
        <button class="inline-add-confirm btn btn-primary" style="font-size:11px;padding:3px 8px;">Add</button>
        <button class="inline-add-cancel" style="font-size:11px;padding:3px 6px;background:transparent;border:none;cursor:pointer;color:var(--text-3);">✕</button>
    `;
    anchor.replaceWith(form);

    // Dropdown appended to body to escape overflow:hidden on grid
    const acList = document.createElement('div');
    acList.className = 'inline-ac-list hidden';
    document.body.appendChild(acList);

    const input = form.querySelector('.inline-add-input');
    let selectedStaffId = null;

    function positionDropdown() {
        const rect = input.getBoundingClientRect();
        acList.style.top = `${rect.bottom + 2}px`;
        acList.style.left = `${rect.left}px`;
        acList.style.width = `${rect.width}px`;
    }

    function renderAC(query) {
        const s = getState();
        const q = query.toLowerCase().trim();
        const matches = q
            ? s.staff.filter(st => st.name.toLowerCase().includes(q))
            : s.staff;
        if (matches.length === 0) { acList.classList.add('hidden'); return; }
        positionDropdown();
        acList.classList.remove('hidden');
        acList.innerHTML = matches.map(st => `
            <div class="inline-ac-item" tabindex="-1" data-staff-id="${escapeHtml(st.id)}" data-staff-name="${escapeHtml(st.name)}" data-staff-role="${escapeHtml(st.role)}">
                <span>${escapeHtml(st.name)}</span>
            </div>`
        ).join('');
        acList.querySelectorAll('.inline-ac-item').forEach(item => {
            item.addEventListener('mousedown', e => {
                e.preventDefault();
                selectedStaffId = item.dataset.staffId;
                input.value = item.dataset.staffName;
                acList.classList.add('hidden');
                input.focus();
            });
        });
    }

    input.addEventListener('focus', () => { positionDropdown(); renderAC(input.value); });
    input.addEventListener('input', () => { selectedStaffId = null; renderAC(input.value); });
    input.addEventListener('blur', () => setTimeout(() => acList.classList.add('hidden'), 150));
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown') {
            const first = acList.querySelector('.inline-ac-item');
            if (first) { e.preventDefault(); first.focus(); }
        }
        if (e.key === 'Enter') { e.preventDefault(); confirmFn(); }
        if (e.key === 'Escape') cancel();
    });
    acList.addEventListener('keydown', e => {
        const items = [...acList.querySelectorAll('.inline-ac-item')];
        const idx = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' && idx < items.length - 1) { e.preventDefault(); items[idx + 1].focus(); }
        if (e.key === 'ArrowUp') { e.preventDefault(); idx > 0 ? items[idx - 1].focus() : input.focus(); }
        if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); items[idx].dispatchEvent(new MouseEvent('mousedown')); confirmFn(); }
        if (e.key === 'Escape') cancel();
    });
    input.focus();

    const cleanup = () => acList.remove();

    const confirmFn = () => {
        const name = input.value.trim();
        cleanup();
        form.replaceWith(anchor);
        if (!name) return;
        const s = getState();
        if (selectedStaffId) {
            const alreadyLinked = (s.staffGroupLinks ?? []).some(l => l.staffId === selectedStaffId && l.groupId === groupId);
            if (!alreadyLinked) {
                setState({ staffGroupLinks: [...(s.staffGroupLinks ?? []), { id: generateId(), staffId: selectedStaffId, groupId }] });
            }
        } else {
            const newId = generateId();
            setState({
                staff: [...s.staff, { id: newId, name, role: 'BT' }],
                staffGroupLinks: [...(s.staffGroupLinks ?? []), { id: generateId(), staffId: newId, groupId }],
            });
        }
    };
    const cancel = () => { cleanup(); form.replaceWith(anchor); };

    form.querySelector('.inline-add-confirm').addEventListener('click', confirmFn);
    form.querySelector('.inline-add-cancel').addEventListener('click', cancel);
}

// Shows a small inline form replacing the trigger button
function showInlineInput(anchor, placeholder, onConfirm, showRoleSelect) {
    const parent = anchor.parentElement;
    const form = document.createElement('div');
    form.className = 'inline-add-form';
    form.innerHTML = `
        <input class="inline-add-input" type="text" placeholder="${escapeHtml(placeholder)}" />
        ${showRoleSelect ? `
            <select class="inline-add-select">
                <option value="BT">BT</option>
                <option value="supervisor">Supervisor</option>
            </select>
        ` : ''}
        <button class="inline-add-confirm btn btn-primary" style="font-size:11px;padding:3px 8px;">Add</button>
        <button class="inline-add-cancel btn-ghost" style="font-size:11px;padding:3px 6px;">✕</button>
    `;
    anchor.replaceWith(form);

    const input = form.querySelector('.inline-add-input');
    const roleSelect = form.querySelector('.inline-add-select');
    input.focus();

    const confirm = () => {
        const val = input.value.trim();
        const role = roleSelect?.value;
        form.replaceWith(anchor);
        onConfirm(val, role);
    };
    const cancel = () => { form.replaceWith(anchor); };

    form.querySelector('.inline-add-confirm').addEventListener('click', confirm);
    form.querySelector('.inline-add-cancel').addEventListener('click', cancel);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); confirm(); }
        if (e.key === 'Escape') cancel();
    });
}

// ===== Lookup panel (Find person) =====

function setupLookupPanel(container, initialUI) {
    const panel = container.querySelector('#lookup-panel');
    const backdrop = container.querySelector('#lookup-backdrop');
    const input = container.querySelector('#lookup-input');
    const body = container.querySelector('#lookup-body');
    const closeBtn = container.querySelector('#lookup-close');
    if (!panel || !input || !body) return { open: () => {} };

    let lastQuery = '';

    function close() {
        panel.classList.remove('open');
        backdrop.classList.remove('open');
    }

    function open() {
        panel.classList.add('open');
        backdrop.classList.add('open');
        setTimeout(() => input.focus(), 60);
    }

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    input.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    input.addEventListener('input', () => {
        lastQuery = input.value;
        doSearch(lastQuery);
    });

    function doSearch(raw) {
        const q = raw.trim().toLowerCase();
        if (!q) {
            const ui = getUI();
            const isToday = ui.currentDate === todayStr();
            body.innerHTML = `<p class="lookup-hint">Search for a staff member or client to see their schedule for ${escapeHtml(isToday ? 'today' : formatDateShort(ui.currentDate))}.</p>`;
            return;
        }
        const s = getState();
        const staffMatches = s.staff.filter(st => st.name.toLowerCase().includes(q));
        const clientMatches = s.clients.filter(c => c.name.toLowerCase().includes(q));

        if (staffMatches.length === 0 && clientMatches.length === 0) {
            body.innerHTML = `<p class="lookup-hint">No matches for "<strong>${escapeHtml(raw.trim())}</strong>"</p>`;
            return;
        }

        const personIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
        const chevron = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;

        let html = '<div class="lookup-results">';
        if (staffMatches.length > 0) {
            if (clientMatches.length > 0) html += `<div class="lookup-section-label">Staff</div>`;
            html += staffMatches.map(st => `
                <div class="lookup-result-item" data-type="staff" data-id="${escapeHtml(st.id)}">
                    <div class="lookup-result-avatar">${personIcon}</div>
                    <div class="lookup-result-info">
                        <span class="lookup-result-name">${escapeHtml(st.name)}</span>
                        <span class="lookup-result-meta">${escapeHtml(st.role || 'Staff')}</span>
                    </div>
                    <div class="lookup-result-chevron">${chevron}</div>
                </div>
            `).join('');
        }
        if (clientMatches.length > 0) {
            html += `<div class="lookup-section-label">Clients</div>`;
            html += clientMatches.map(c => `
                <div class="lookup-result-item" data-type="client" data-id="${escapeHtml(c.id)}">
                    <div class="lookup-result-avatar">${personIcon}</div>
                    <div class="lookup-result-info">
                        <span class="lookup-result-name">${escapeHtml(c.name)}</span>
                        <span class="lookup-result-meta">Client</span>
                    </div>
                    <div class="lookup-result-chevron">${chevron}</div>
                </div>
            `).join('');
        }
        html += '</div>';
        body.innerHTML = html;

        body.querySelectorAll('.lookup-result-item').forEach(item => {
            item.addEventListener('click', () => showPerson(item.dataset.type, item.dataset.id));
        });
    }

    function showPerson(type, id) {
        const s = getState();
        const ui = getUI();
        const dow = getDayOfWeek(ui.currentDate);
        const isToday = ui.currentDate === todayStr();

        let personName, personRole, staffId;
        if (type === 'staff') {
            const person = s.staff.find(st => st.id === id);
            if (!person) return;
            personName = person.name;
            personRole = person.role || 'Staff';
            staffId = person.id;
        } else {
            const client = s.clients.find(c => c.id === id);
            if (!client) return;
            personName = client.name;
            personRole = 'Client';
            staffId = client.staffId;
        }

        const personIcon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

        let html = `
            <div class="lookup-person-view">
                <button class="lookup-back-btn" id="lookup-back">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
                    Back
                </button>
                <div class="lookup-person-header">
                    <div class="lookup-person-avatar">${personIcon}</div>
                    <div>
                        <div class="lookup-person-name">${escapeHtml(personName)}</div>
                        <div class="lookup-person-role">${escapeHtml(personRole)}</div>
                    </div>
                </div>
                <div class="lookup-person-date">${isToday ? 'Today' : escapeHtml(formatDateFull(ui.currentDate))}</div>
        `;

        ['AM', 'MD', 'PM'].forEach(session => {
            const group = staffId ? getBTGroupForSession(s, staffId, session, dow) : null;
            const slots = getActiveSlots(s, session);
            const sessionRange = slots.length
                ? `${slots[0].split(' - ')[0]} – ${slots[slots.length - 1].split(' - ')[1]}`
                : '';

            html += `
                <div class="lookup-session-block">
                    <div class="lookup-session-head">
                        <span class="lookup-session-pill">${session}</span>
                        ${sessionRange ? `<span class="lookup-session-time">${escapeHtml(sessionRange)}</span>` : ''}
                        ${group ? `<span class="lookup-session-group">${escapeHtml(group.name)}</span>` : ''}
                    </div>
                    ${group && slots.length > 0 ? `
                        <div class="lookup-session-slots">
                            ${slots.map((slot, i) => {
                                const assignment = resolveAssignment(s, group.id, ui.currentDate, session, i);
                                const color = assignment ? getRoomColor(assignment.roomName) : null;
                                const [start] = slot.split(' - ');
                                return `
                                    <div class="lookup-slot-row">
                                        <div class="lookup-slot-dot" style="background:${color || 'var(--border)'}"></div>
                                        <span class="lookup-slot-time">${escapeHtml(start)}</span>
                                        <span class="lookup-slot-room ${assignment ? '' : 'empty'}">${assignment ? escapeHtml(assignment.roomName) : '—'}</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : `<div class="lookup-session-empty">No schedule this session</div>`}
                </div>
            `;
        });

        html += `</div>`;
        body.innerHTML = html;
        body.querySelector('#lookup-back').addEventListener('click', () => doSearch(lastQuery));
    }

    return { open };
}

// Activity editing inline
function showActivityEditor(cell, groupId, slotIndex) {
    const ui = getUI();
    const currentActivity = resolveActivity(getState(), groupId, ui.currentDate, ui.currentSession, slotIndex) || '';

    const editor = document.createElement('div');
    editor.className = 'activity-editor';
    editor.innerHTML = `
        <input type="text" class="activity-input" value="${escapeHtml(currentActivity)}" placeholder="Add activity notes…" maxlength="200" />
        <div class="activity-editor-actions">
            <button class="btn btn-primary btn-sm activity-save">Save</button>
            <button class="btn btn-ghost btn-sm activity-cancel">Cancel</button>
        </div>
    `;

    cell.replaceWith(editor);
    const input = editor.querySelector('.activity-input');
    input.focus();
    input.select();

    const save = () => {
        const newActivity = input.value.trim();
        const s = getState();
        const activities = s.activities ?? [];
        const existingIdx = activities.findIndex(a =>
            a.groupId === groupId && a.date === ui.currentDate &&
            a.session === ui.currentSession && a.timeSlotIndex === slotIndex
        );

        let newActivities;
        if (existingIdx >= 0) {
            newActivities = newActivity
                ? activities.map((a, i) => i === existingIdx ? { ...a, activity: newActivity } : a)
                : activities.filter((_, i) => i !== existingIdx);
        } else if (newActivity) {
            newActivities = [...activities, { id: generateId(), groupId, date: ui.currentDate, session: ui.currentSession, timeSlotIndex: slotIndex, activity: newActivity }];
        } else {
            newActivities = activities;
        }
        setState({ activities: newActivities });
    };

    const cancel = () => setState({});

    editor.querySelector('.activity-save').addEventListener('click', save);
    editor.querySelector('.activity-cancel').addEventListener('click', cancel);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancel();
    });
}

let _savedTickInterval = null;
function startSavedTicker(container) {
    clearInterval(_savedTickInterval);
    _savedTickInterval = setInterval(() => {
        const el = container.querySelector('#saved-indicator');
        if (!el) { clearInterval(_savedTickInterval); return; }
        const lastSaved = getLastSavedAt();
        if (lastSaved) el.textContent = `Saved ${timeAgo(lastSaved)}`;
    }, 5000);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pacific_clinics_theme', next);
}
