import { getState, getUI, setState } from '../state.js';
import { escapeHtml, formatDateShort, formatDateFull, todayStr, getCurrentSlotIndex, getCurrentSession, getDayOfWeek, getDayShort, generateId, getWeekDates, offsetDate } from '../utils.js';
import { resolveAssignment, resolveActivity, getBTGroupForSession, getActiveSlots, getRoomColor, getStaffGroups, getGroupStaff } from '../data.js';

export function renderBTView(container, { onSwitchSession, onChangeDate, onSwitchRole, onViewMaster, onWeekView, onGoToDate }) {
    const state = getState();
    const ui = getUI();
    const staff = state.staff.find(s => s.id === ui.staffId);
    const dow = getDayOfWeek(ui.currentDate);
    const activeSession = getCurrentSession(state.settings.sessions);
    const isToday = ui.currentDate === todayStr();

    // Auto-enter session view only if BT has a group in the currently active session
    const activeGroup = activeSession ? getBTGroupForSession(state, ui.staffId, activeSession, dow) : null;
    const autoSessionActive = isToday && activeSession !== null && activeGroup !== null;
    const showDayView = !ui.btSessionFocused && !autoSessionActive;
    // When auto-showing due to active session, use activeSession; otherwise use the tab the BT selected
    const effectiveSession = !showDayView && !ui.btSessionFocused ? activeSession : ui.currentSession;

    // Session-focused view state
    const slots = getActiveSlots(state, effectiveSession);
    const activeSlotIdx = getCurrentSlotIndex(slots);
    const group = staff ? getBTGroupForSession(state, ui.staffId, effectiveSession, dow) : null;

    let nowAssignment = null;
    if (isToday && activeSlotIdx !== -1 && effectiveSession === activeSession && group) {
        nowAssignment = resolveAssignment(state, group.id, ui.currentDate, effectiveSession, activeSlotIdx);
    }

    container.innerHTML = `
        <header class="app-header">
            <div class="header-logo">Northstar<span>ABA</span></div>
            <div class="session-tabs">
                ${['AM','MD','PM'].map(s => {
                    const hasGroup = !!getBTGroupForSession(state, ui.staffId, s, dow);
                    const isSelected = !showDayView && effectiveSession === s;
                    return `<button class="tab-btn ${isSelected ? 'active' : ''} ${activeSession === s && !isSelected ? 'active-now' : ''} ${!hasGroup ? 'tab-no-schedule' : ''}" data-session="${s}">${s}</button>`;
                }).join('')}
            </div>
            <div class="header-spacer"></div>
            <div class="date-nav">
                <button class="btn-icon" id="prev-day" aria-label="Previous day">
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span class="date-label">${isToday ? 'Today' : formatDateShort(ui.currentDate)}</span>
                <button class="btn-icon" id="next-day" aria-label="Next day">
                    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
            <button class="btn btn-ghost" id="theme-toggle" aria-label="Toggle theme" title="Toggle theme">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </button>
        </header>

        <div class="main-content">
            ${ui.btWeekView
                ? renderWeekView(state, staff, ui)
                : showDayView
                    ? renderDayView(state, staff, ui, dow, isToday, activeSession)
                    : renderSessionFocused(state, staff, ui, group, slots, activeSlotIdx, isToday, activeSession, nowAssignment, dow, effectiveSession)
            }
        </div>
    `;

    container.querySelector('.session-tabs').addEventListener('click', e => {
        const btn = e.target.closest('.tab-btn');
        if (btn) onSwitchSession(btn.dataset.session);
    });
    container.querySelector('#prev-day').addEventListener('click', () => onChangeDate(-1));
    container.querySelector('#next-day').addEventListener('click', () => onChangeDate(1));
    container.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
    container.querySelector('#switch-role-btn')?.addEventListener('click', onSwitchRole);
    container.querySelector('#view-master-btn')?.addEventListener('click', onViewMaster);
    container.querySelector('#week-view-btn')?.addEventListener('click', onWeekView);
    container.querySelector('#prev-week')?.addEventListener('click', () => onChangeDate(-7));
    container.querySelector('#next-week')?.addEventListener('click', () => onChangeDate(7));
    container.querySelectorAll('.bt-week-day[data-date]').forEach(card => {
        card.addEventListener('click', () => onGoToDate(card.dataset.date));
    });

    // Activity editing — clicking anywhere on an assigned slot row opens the editor
    const mainContent = container.querySelector('.main-content');
    if (mainContent) {
        mainContent.addEventListener('click', e => {
            const slotRow = e.target.closest('.bt-day-slot-row[data-group-id], .bt-slot-row[data-group-id]');
            if (!slotRow || !slotRow.dataset.groupId) return;
            e.stopPropagation();
            const groupId = slotRow.dataset.groupId;
            const slotIndex = parseInt(slotRow.dataset.slotIndex, 10);
            const session = slotRow.dataset.session || getUI().currentSession;
            showBTActivityEditor(slotRow, groupId, slotIndex, session);
        });
    }
}

// ===== Day overview (3-column) =====

function renderDayView(state, staff, ui, dow, isToday, activeSession) {
    const betweenSessions = isToday && activeSession === null;

    return `
        <div class="bt-day-view">
            <div class="bt-day-header">
                ${staff ? `<span class="bt-day-name">${escapeHtml(staff.name)}</span>` : ''}
                <span class="bt-day-date">${isToday ? 'Today' : formatDateFull(ui.currentDate)}</span>
                ${betweenSessions ? `
                    <span class="bt-between-badge">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        Between sessions
                    </span>
                ` : ''}
            </div>

            <div class="bt-day-columns">
                ${['AM', 'MD', 'PM'].map((s, i) => renderDayColumn(state, staff, ui, dow, s, i)).join('')}
            </div>

            <div class="bt-day-footer">
                <button class="btn btn-secondary" id="view-master-btn">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Master Schedule
                </button>
                <button class="btn btn-ghost" id="week-view-btn" style="font-size:12px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Week
                </button>
                <button class="btn btn-ghost" id="switch-role-btn" style="font-size:12px;color:var(--text-3);">Log out</button>
            </div>
        </div>
    `;
}

function renderDayColumn(state, staff, ui, dow, session, colIdx = 0) {
    const group = staff ? getBTGroupForSession(state, ui.staffId, session, dow) : null;
    const slots = getActiveSlots(state, session);
    const sessionRange = slots.length
        ? `${slots[0].split(' - ')[0]} – ${slots[slots.length - 1].split(' - ')[1]}`
        : '';
    const collaborators = group
        ? getGroupStaff(state, group.id).filter(s => s.id !== ui.staffId)
        : [];

    return `
        <div class="bt-day-col" style="--col-idx:${colIdx}">
            <div class="bt-day-col-header">
                <span class="bt-day-col-session">${session}</span>
                ${sessionRange ? `<span class="bt-day-col-time">${escapeHtml(sessionRange)}</span>` : ''}
            </div>
            ${group
                ? `<div class="bt-day-col-group">${escapeHtml(group.name)}</div>
                   ${collaborators.length ? `<div class="bt-col-staff">${collaborators.map(s => `<span class="bt-col-staff-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escapeHtml(s.name)}</span>`).join('')}</div>` : ''}
                   <div class="bt-day-col-slots">
                       ${slots.length === 0
                           ? `<p class="bt-day-col-empty-msg">No slots</p>`
                           : slots.map((slot, i) => {
                               const assignment = resolveAssignment(state, group.id, ui.currentDate, session, i);
                               const activity = resolveActivity(state, group.id, ui.currentDate, session, i);
                               const color = assignment ? getRoomColor(assignment.roomName) : null;
                               const [start] = slot.split(' - ');
                               return `
                                   <div class="bt-day-slot-row bt-day-slot-row--editable" data-group-id="${escapeHtml(group.id)}" data-slot-index="${i}" data-session="${session}">
                                       <div class="bt-day-slot-dot" style="background:${color || 'var(--border)'}"></div>
                                       <span class="bt-day-slot-time">${escapeHtml(start)}</span>
                                       <span class="bt-day-slot-room ${assignment ? '' : 'empty'}">${assignment ? escapeHtml(assignment.roomName) : '—'}</span>
                                       ${activity
                                           ? `<span class="bt-day-slot-activity" title="${escapeHtml(activity)}">${escapeHtml(activity)}</span>`
                                           : `<span class="bt-day-slot-activity-hint">+ activity</span>`}
                                   </div>
                               `;
                           }).join('')
                       }
                   </div>`
                : `<p class="bt-day-col-empty-msg">No schedule</p>`
            }
        </div>
    `;
}

// ===== Session-focused view =====

function renderSessionFocused(state, staff, ui, group, slots, activeSlotIdx, isToday, activeSession, nowAssignment, dow, effectiveSession) {
    const collaborators = group ? getGroupStaff(state, group.id).filter(s => s.id !== ui.staffId) : [];
    return `
        <div class="bt-view">
            ${group ? `
                <div style="margin-bottom:12px;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
                        <span style="font-size:13px;font-weight:600;color:var(--text)">${escapeHtml(group.name)}</span>
                        <span style="font-size:11px;color:var(--text-2)">· ${staff ? escapeHtml(staff.name) : ''}</span>
                    </div>
                    ${collaborators.length ? `<div class="bt-col-staff">${collaborators.map(s => `<span class="bt-col-staff-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${escapeHtml(s.name)}</span>`).join('')}</div>` : ''}
                </div>
            ` : ''}

            ${renderNowCard(nowAssignment, slots, activeSlotIdx, isToday, activeSession, effectiveSession)}

            <div class="bt-day-list" id="bt-slot-list">
                ${slots.length === 0
                    ? `<p style="color:var(--text-3);font-size:13px;text-align:center;padding:24px 0;">No time slots configured for this session.</p>`
                    : slots.map((slot, i) => renderSlotRow(state, group, ui, slot, i, activeSlotIdx, isToday, activeSession, effectiveSession)).join('')
                }
            </div>

            <div class="bt-session-footer">
                <button class="btn btn-ghost" id="view-master-btn" style="font-size:12px;color:var(--text-2);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Master Schedule
                </button>
                <button class="btn btn-ghost" id="switch-role-btn" style="font-size:12px;color:var(--text-3);">Log out</button>
            </div>
        </div>
    `;
}

function renderNowCard(assignment, slots, slotIdx, isToday, activeSession, currentSession) {
    const isActiveSession = isToday && currentSession === activeSession;

    if (!isActiveSession || slotIdx === -1) {
        return `
            <div class="bt-now-card no-assignment">
                <div class="bt-now-label">Right now</div>
                <div class="bt-now-room">${isToday ? 'No active session' : 'Viewing another day'}</div>
            </div>
        `;
    }

    if (!assignment) {
        return `
            <div class="bt-now-card no-assignment">
                <div class="bt-now-label">Right now · ${escapeHtml(slots[slotIdx])}</div>
                <div class="bt-now-room">No room assigned</div>
            </div>
        `;
    }

    const color = getRoomColor(assignment.roomName);
    return `
        <div class="bt-now-card" style="background:${color}22;border-left:4px solid ${color};box-shadow:none;">
            <div class="bt-now-label" style="color:${color};">Right now · ${escapeHtml(slots[slotIdx])}</div>
            <div class="bt-now-room" style="color:${color};">${escapeHtml(assignment.roomName)}</div>
        </div>
    `;
}

function renderSlotRow(state, group, ui, slot, i, activeSlotIdx, isToday, activeSession, effectiveSession) {
    const session = effectiveSession ?? ui.currentSession;
    const assignment = group ? resolveAssignment(state, group.id, ui.currentDate, session, i) : null;
    const activity = group ? resolveActivity(state, group.id, ui.currentDate, session, i) : null;
    const isNow = isToday && session === activeSession && i === activeSlotIdx;
    const isPast = isToday && session === activeSession && activeSlotIdx !== -1 && i < activeSlotIdx;
    const color = assignment ? getRoomColor(assignment.roomName) : null;

    return `
        <div class="bt-slot-row ${isNow ? 'is-now' : ''} ${isPast ? 'is-past' : ''}" style="--slot-idx:${i}" data-group-id="${group ? escapeHtml(group.id) : ''}" data-slot-index="${i}" data-session="${session}">
            ${color
                ? `<div class="bt-slot-dot" style="background:${color}"></div>`
                : `<div class="bt-slot-dot" style="background:var(--border)"></div>`
            }
            <span class="bt-slot-time">${escapeHtml(slot)}</span>
            <span class="bt-slot-room ${assignment ? '' : 'empty'}">${assignment ? escapeHtml(assignment.roomName) : '—'}</span>
            ${activity ? `<span class="bt-slot-activity" title="${escapeHtml(activity)}">${escapeHtml(activity)}</span>` : ''}
        </div>
    `;
}

function showBTActivityEditor(slotRow, groupId, slotIndex, session) {
    const ui = getUI();
    const currentActivity = resolveActivity(getState(), groupId, ui.currentDate, session, slotIndex) || '';

    const editor = document.createElement('div');
    editor.className = 'activity-editor-mobile';
    editor.innerHTML = `
        <input type="text" class="activity-input" value="${escapeHtml(currentActivity)}" placeholder="Add activity notes…" maxlength="200" />
        <div class="activity-editor-actions">
            <button class="btn btn-primary btn-sm activity-save">Save</button>
            <button class="btn btn-ghost btn-sm activity-cancel">Cancel</button>
        </div>
    `;

    slotRow.replaceWith(editor);
    const input = editor.querySelector('.activity-input');
    input.focus();
    input.select();

    const save = () => {
        const newActivity = input.value.trim();
        const activities = getState().activities ?? [];
        const existingIdx = activities.findIndex(a =>
            a.groupId === groupId && a.date === ui.currentDate &&
            a.session === session && a.timeSlotIndex === slotIndex
        );

        let newActivities;
        if (existingIdx >= 0) {
            newActivities = newActivity
                ? activities.map((a, i) => i === existingIdx ? { ...a, activity: newActivity } : a)
                : activities.filter((_, i) => i !== existingIdx);
        } else if (newActivity) {
            newActivities = [...activities, { id: generateId(), groupId, date: ui.currentDate, session, timeSlotIndex: slotIndex, activity: newActivity }];
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

// ===== Week view =====

function renderWeekView(state, staff, ui) {
    const weekDates = getWeekDates(ui.currentDate);
    const today = todayStr();
    const weekLabel = `${formatDateShort(weekDates[0])} – ${formatDateShort(weekDates[4])}`;

    return `
        <div class="bt-week-view">
            <div class="bt-week-nav">
                <button class="btn-icon" id="prev-week" aria-label="Previous week">
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span class="bt-week-label">${weekLabel}</span>
                <button class="btn-icon" id="next-week" aria-label="Next week">
                    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            </div>
            <div class="bt-week-days">
                ${weekDates.map(date => renderWeekDay(state, staff, ui, date, date === today)).join('')}
            </div>
            <div class="bt-day-footer">
                <button class="btn btn-secondary" id="view-master-btn">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Master Schedule
                </button>
                <button class="btn btn-ghost" id="switch-role-btn" style="font-size:12px;color:var(--text-3);">Log out</button>
            </div>
        </div>
    `;
}

function renderWeekDay(state, staff, ui, date, isToday) {
    const dow = getDayOfWeek(date);
    const sessions = ['AM', 'MD', 'PM'].map(session => {
        const group = staff ? getBTGroupForSession(state, ui.staffId, session, dow) : null;
        if (!group) return { session, group: null };
        const slots = getActiveSlots(state, session);
        const sessionRange = slots.length
            ? `${slots[0].split(' - ')[0]} – ${slots[slots.length - 1].split(' - ')[1]}`
            : '';
        const rooms = slots.map((_, i) => resolveAssignment(state, group.id, date, session, i)).filter(Boolean);
        const activities = slots.map((_, i) => resolveActivity(state, group.id, date, session, i)).filter(Boolean);
        return { session, group, sessionRange, rooms, activities };
    });
    const hasSchedule = sessions.some(s => s.group);

    return `
        <div class="bt-week-day ${isToday ? 'is-today' : ''}" data-date="${date}">
            <div class="bt-week-day-hd">
                <span class="bt-week-dow">${getDayShort(dow)}</span>
                <span class="bt-week-date">${formatDateShort(date)}</span>
                ${isToday ? '<span class="bt-week-today-pill">Today</span>' : ''}
            </div>
            ${hasSchedule
                ? sessions.map(({ session, group, sessionRange, rooms, activities }) => {
                    if (!group) return `<div class="bt-week-sess bt-week-sess--empty"><span class="bt-week-sess-badge">${session}</span><span class="bt-week-sess-none">—</span></div>`;
                    const dots = rooms.slice(0, 10).map(r => `<span class="bt-week-dot" style="background:${getRoomColor(r.roomName)}"></span>`).join('');
                    return `
                        <div class="bt-week-sess">
                            <span class="bt-week-sess-badge">${session}</span>
                            <div class="bt-week-sess-body">
                                <div class="bt-week-sess-top">
                                    <span class="bt-week-sess-group">${escapeHtml(group.name)}</span>
                                    <span class="bt-week-sess-time">${escapeHtml(sessionRange)}</span>
                                </div>
                                ${dots ? `<div class="bt-week-dots">${dots}</div>` : ''}
                                ${activities.map(a => `<div class="bt-week-activity">${escapeHtml(a)}</div>`).join('')}
                            </div>
                        </div>
                    `;
                }).join('')
                : `<p class="bt-week-no-sched">No schedule</p>`
            }
        </div>
    `;
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('scheduler_theme', next);
}
