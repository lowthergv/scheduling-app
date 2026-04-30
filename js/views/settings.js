import { getState, setState, setStateSilent } from '../state.js';
import { escapeHtml, generateId, getDayName } from '../utils.js';
import { autoAssignRooms } from '../data.js';

const TABS = ['Rooms', 'Sessions', 'Staff', 'Extras'];

export function openSettings(initialTab = 'Rooms', { onClose, onChangePIN } = {}) {
    const overlay = document.getElementById('settings-overlay');
    const panel = document.getElementById('settings-panel');
    overlay.classList.add('open');

    let activeTab = initialTab;

    function render() {
        panel.innerHTML = `
            <div class="settings-header">
                <h2>Settings</h2>
                <button class="btn-icon" id="settings-close">
                    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
            <div class="settings-tabs">
                ${TABS.map(t => `<button class="settings-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}">${t}</button>`).join('')}
            </div>
            <div class="settings-body" id="settings-body">
                ${renderTab(activeTab)}
            </div>
        `;

        panel.querySelector('.settings-tabs').addEventListener('click', e => {
            const btn = e.target.closest('.settings-tab');
            if (btn) { activeTab = btn.dataset.tab; render(); }
        });

        panel.querySelector('#settings-close').addEventListener('click', close);

        bindTabListeners(activeTab, panel, render, { close, onChangePIN });
    }

    function close() {
        overlay.classList.remove('open');
        onClose?.();
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); }, { once: false });
    // Use one persistent handler
    overlay._closeHandler = close;

    render();
}

function renderTab(tab) {
    const state = getState();
    switch (tab) {
        case 'Rooms':    return renderRooms(state);
        case 'Sessions': return renderSessions(state);
        case 'Staff':    return renderStaff(state);
        case 'Extras':   return renderExtras(state);
        default:         return '';
    }
}

// ===== Rooms =====
function renderRooms(state) {
    return `
        <div class="settings-section">
            <h3>Managed Rooms</h3>
            <div id="rooms-list">
                ${state.settings.rooms.map((r, i) => `
                    <div class="list-item" data-idx="${i}">
                        <span class="list-item-text">${escapeHtml(r)}</span>
                        <div class="list-item-actions">
                            <button class="btn btn-ghost btn-danger" data-action="remove-room" data-idx="${i}" title="Remove" style="font-size:11px;padding:2px 6px;">Remove</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="add-row">
                <input type="text" id="new-room-input" placeholder="New room name…" />
                <button class="btn btn-primary" id="add-room-btn">Add</button>
            </div>
        </div>
    `;
}

// ===== Sessions =====
function renderSessions(state) {
    return Object.entries(state.settings.sessions).map(([key, { slots }]) => `
        <div class="settings-section">
            <h3>${key} Session</h3>
            <div id="slots-list-${key}">
                ${slots.map((s, i) => `
                    <div class="list-item">
                        <span class="list-item-text">${escapeHtml(s)}</span>
                        <div class="list-item-actions">
                            <button class="btn btn-ghost" style="font-size:11px;color:var(--danger,#DA3633);padding:2px 6px;" data-action="remove-slot" data-session="${key}" data-idx="${i}">Remove</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="add-row">
                <input type="text" id="new-slot-${key}" placeholder="e.g. 9:00 - 9:25" />
                <button class="btn btn-primary" data-action="add-slot" data-session="${key}">Add</button>
            </div>
        </div>
    `).join('');
}

// ===== Staff =====
function renderStaff(state) {
    return `
        <div class="settings-section">
            <h3>Staff Members</h3>
            ${state.staff.length === 0
                ? `<p style="color:var(--text-3);font-size:13px;font-style:italic;margin-bottom:12px;">No staff yet.</p>`
                : state.staff.map(s => `
                    <div class="list-item">
                        <span class="list-item-text">${escapeHtml(s.name)}</span>
                        <span style="font-size:11px;color:var(--text-3);margin-right:8px;">${escapeHtml(s.role === 'BT' ? 'BT' : 'Supervisor')}</span>
                        <div class="list-item-actions">
                            <button class="btn btn-ghost" style="font-size:11px;color:#DA3633;padding:2px 6px;" data-action="remove-staff" data-id="${escapeHtml(s.id)}">Remove</button>
                        </div>
                    </div>
                `).join('')}
            <div class="add-row" style="margin-top:12px;">
                <input type="text" id="new-staff-name" placeholder="Name…" autocomplete="off" style="flex:1;" />
                <select class="form-input form-select" id="new-staff-role" style="width:auto;flex-shrink:0;">
                    <option value="BT">BT</option>
                    <option value="supervisor">Supervisor</option>
                </select>
                <button class="btn btn-primary" id="add-staff-btn">Add</button>
            </div>
        </div>
    `;
}

// ===== Extras =====
function renderExtras(state) {
    const enabled = state.settings.extras?.autoAssign ?? false;
    const sessions = Object.keys(state.settings.sessions);
    const workdays = [1, 2, 3, 4, 5];
    const overlapRules = state.settings.extras?.overlapRules ?? {};
    const rooms = state.settings.rooms;

    return `
        <div class="extras-wip-banner">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Work in progress — these features are experimental
        </div>

        <div class="settings-section">
            <div class="extras-feature-row">
                <div class="extras-feature-info">
                    <h3>Auto-assign Rooms</h3>
                    <p class="extras-feature-desc">Fill empty time slots by assigning rooms in order. Rooms won't overlap between groups unless you increase their capacity below.</p>
                </div>
                <label class="toggle-switch" title="${enabled ? 'Disable' : 'Enable'} auto-assign">
                    <input type="checkbox" id="aa-enabled" ${enabled ? 'checked' : ''}>
                    <span class="toggle-track"><span class="toggle-thumb"></span></span>
                </label>
            </div>

            ${enabled ? `
            <div class="extras-body">
                <div class="extras-options">
                    <div class="extras-option-row">
                        <label for="aa-session">Session</label>
                        <select id="aa-session" class="form-input form-select" style="flex:1;">
                            ${sessions.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="extras-option-row">
                        <label for="aa-day">Day</label>
                        <select id="aa-day" class="form-input form-select" style="flex:1;">
                            ${workdays.map(d => `<option value="${d}">${escapeHtml(getDayName(d))}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="aa-capacity-section">
                    <div class="aa-capacity-header">
                        <span class="aa-capacity-title">Room capacity</span>
                        <span class="aa-capacity-hint">Max concurrent groups per slot</span>
                    </div>
                    ${rooms.length === 0
                        ? `<p class="extras-feature-desc" style="font-style:italic;margin-top:6px;">No rooms yet — add rooms in the Rooms tab.</p>`
                        : rooms.map(r => {
                            const cap = overlapRules[r] ?? 1;
                            return `
                            <div class="aa-cap-row">
                                <span class="aa-cap-room-name">${escapeHtml(r)}</span>
                                <div class="aa-cap-stepper">
                                    <button class="aa-cap-btn" data-room="${escapeHtml(r)}" data-delta="-1" ${cap <= 1 ? 'disabled' : ''}>−</button>
                                    <span class="aa-cap-val" data-room="${escapeHtml(r)}">${cap}</span>
                                    <button class="aa-cap-btn" data-room="${escapeHtml(r)}" data-delta="1">+</button>
                                </div>
                                ${cap > 1 ? `<span class="aa-cap-badge">shared</span>` : ''}
                            </div>`;
                        }).join('')
                    }
                </div>

                <div id="aa-result" class="extras-result hidden"></div>
                <button class="btn btn-primary" id="aa-run-btn" style="width:100%;justify-content:center;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    Run auto-assign
                </button>
            </div>
            ` : ''}
        </div>

        <div class="settings-section">
            <div class="extras-feature-row">
                <div class="extras-feature-info">
                    <h3>Admin PIN</h3>
                    <p class="extras-feature-desc">Change the PIN used to access admin edit mode.</p>
                </div>
                <button class="btn btn-ghost" id="change-pin-btn" style="font-size:12px;flex-shrink:0;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Change PIN
                </button>
            </div>
        </div>
    `;
}

function runAutoAssign(session, dayOfWeek) {
    const s = getState();
    const { filled, groups, skipped, newAssignments } = autoAssignRooms(s, session, dayOfWeek);
    setState({ masterAssignments: newAssignments });
    return { filled, groups, skipped };
}

// ===== Bind per-tab listeners =====
function bindTabListeners(tab, panel, rerender, { close, onChangePIN } = {}) {
    const state = getState();

    if (tab === 'Rooms') {
        panel.querySelector('#add-room-btn').addEventListener('click', () => {
            const input = panel.querySelector('#new-room-input');
            const val = input.value.trim();
            if (!val) return;
            const s = getState();
            if (s.settings.rooms.includes(val)) { input.focus(); return; }
            setStateSilent({ settings: { ...s.settings, rooms: [...s.settings.rooms, val] } });
            rerender();
        });
        panel.querySelector('#new-room-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') panel.querySelector('#add-room-btn').click();
        });
        panel.querySelectorAll('[data-action="remove-room"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx, 10);
                const s = getState();
                const rooms = s.settings.rooms.filter((_, i) => i !== idx);
                setStateSilent({ settings: { ...s.settings, rooms } });
                rerender();
            });
        });
    }

    if (tab === 'Sessions') {
        panel.querySelectorAll('[data-action="add-slot"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const session = btn.dataset.session;
                const input = panel.querySelector(`#new-slot-${session}`);
                const val = input.value.trim();
                if (!val) return;
                const s = getState();
                const updated = { ...s.settings.sessions, [session]: { slots: [...s.settings.sessions[session].slots, val] } };
                setStateSilent({ settings: { ...s.settings, sessions: updated } });
                rerender();
            });
        });
        panel.querySelectorAll(`input[id^="new-slot-"]`).forEach(input => {
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    const session = input.id.replace('new-slot-', '');
                    panel.querySelector(`[data-action="add-slot"][data-session="${session}"]`)?.click();
                }
            });
        });
        panel.querySelectorAll('[data-action="remove-slot"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const session = btn.dataset.session;
                const idx = parseInt(btn.dataset.idx, 10);
                const s = getState();
                const slots = s.settings.sessions[session].slots.filter((_, i) => i !== idx);
                const updated = { ...s.settings.sessions, [session]: { slots } };
                setStateSilent({ settings: { ...s.settings, sessions: updated } });
                rerender();
            });
        });
    }

    if (tab === 'Extras') {
        panel.querySelector('#aa-enabled')?.addEventListener('change', e => {
            const s = getState();
            setStateSilent({ settings: { ...s.settings, extras: { ...s.settings.extras, autoAssign: e.target.checked } } });
            rerender();
        });

        panel.querySelector('#aa-run-btn')?.addEventListener('click', () => {
            const session = panel.querySelector('#aa-session').value;
            const dayOfWeek = parseInt(panel.querySelector('#aa-day').value, 10);
            const { filled, groups, skipped } = runAutoAssign(session, dayOfWeek);
            const resultEl = panel.querySelector('#aa-result');
            if (resultEl) {
                resultEl.classList.remove('hidden');
                if (filled === 0 && skipped === 0) {
                    resultEl.textContent = groups === 0
                        ? `No groups found for ${getDayName(dayOfWeek)} ${session}.`
                        : `All slots already assigned — nothing to fill.`;
                    resultEl.className = 'extras-result extras-result--neutral';
                } else {
                    const parts = [];
                    if (filled > 0) parts.push(`Filled ${filled} slot${filled !== 1 ? 's' : ''} across ${groups} group${groups !== 1 ? 's' : ''}.`);
                    if (skipped > 0) parts.push(`${skipped} slot${skipped !== 1 ? 's' : ''} skipped — all rooms at capacity.`);
                    resultEl.textContent = parts.join(' ');
                    resultEl.className = skipped > 0 && filled === 0
                        ? 'extras-result extras-result--neutral'
                        : 'extras-result extras-result--success';
                }
            }
        });

        // Room capacity steppers — save without rerender to avoid losing scroll position
        panel.querySelectorAll('.aa-cap-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const room = btn.dataset.room;
                const delta = parseInt(btn.dataset.delta, 10);
                const s = getState();
                const current = s.settings.extras?.overlapRules?.[room] ?? 1;
                const next = Math.max(1, current + delta);
                const rules = { ...(s.settings.extras?.overlapRules ?? {}), [room]: next };
                setStateSilent({ settings: { ...s.settings, extras: { ...s.settings.extras, overlapRules: rules } } });
                // Update DOM without full rerender
                const valEl = panel.querySelector(`.aa-cap-val[data-room="${room}"]`);
                if (valEl) valEl.textContent = next;
                const minusBtn = panel.querySelector(`.aa-cap-btn[data-room="${room}"][data-delta="-1"]`);
                if (minusBtn) minusBtn.disabled = next <= 1;
                const row = btn.closest('.aa-cap-row');
                if (row) {
                    let badge = row.querySelector('.aa-cap-badge');
                    if (next > 1 && !badge) {
                        badge = document.createElement('span');
                        badge.className = 'aa-cap-badge';
                        badge.textContent = 'shared';
                        row.appendChild(badge);
                    } else if (next <= 1 && badge) {
                        badge.remove();
                    }
                }
            });
        });

        panel.querySelector('#change-pin-btn')?.addEventListener('click', () => {
            close?.();
            onChangePIN?.();
        });
    }

    if (tab === 'Staff') {
        panel.querySelector('#add-staff-btn').addEventListener('click', () => {
            const name = panel.querySelector('#new-staff-name').value.trim();
            const role = panel.querySelector('#new-staff-role').value;
            if (!name) { panel.querySelector('#new-staff-name').focus(); return; }
            const s = getState();
            setStateSilent({ staff: [...s.staff, { id: generateId(), name, role }] });
            rerender();
        });
        panel.querySelector('#new-staff-name').addEventListener('keydown', e => {
            if (e.key === 'Enter') panel.querySelector('#add-staff-btn').click();
        });
        panel.querySelectorAll('[data-action="remove-staff"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const s = getState();
                setStateSilent({
                    staff: s.staff.filter(st => st.id !== id),
                    staffGroupLinks: (s.staffGroupLinks ?? []).filter(l => l.staffId !== id),
                });
                rerender();
            });
        });
    }

}
