import { todayStr, getCurrentSession, generateId } from './utils.js';
import { buildDemoState } from './seed.js';

const STATE_KEY = 'pacific_clinics_state';
const UI_KEY = 'pacific_clinics_ui';

const DEFAULT_STATE = {
    settings: {
        pin: null,
        rooms: ['Room 1', 'Room 2', 'Room 3', 'Gym', 'Art Room', 'Sensory Room'],
        sessions: {
            AM: { slots: ['9:00 - 9:25', '9:25 - 9:50', '9:50 - 10:15', '10:15 - 10:40', '10:40 - 11:05', '11:05 - 11:30', '11:30 - 11:55', '11:55 - 12:15'] },
            MD: { slots: ['12:30 - 12:55', '12:55 - 1:20', '1:20 - 1:45', '1:45 - 2:10', '2:10 - 2:30'] },
            PM: { slots: ['3:30 - 3:55', '3:55 - 4:20', '4:20 - 4:45', '4:45 - 5:10', '5:10 - 5:30'] },
        },
    },
    groups: [],
    staff: [],
    staffGroupLinks: [],
    clients: [],
    masterAssignments: [],
    overrides: [],
    activities: [],
};

function defaultUI(state) {
    const session = getCurrentSession(state.settings.sessions) || 'AM';
    return { role: null, staffId: null, currentDate: todayStr(), currentSession: session, isAdminMode: false, viewingMaster: false };
}

let _state = null;
let _ui = null;
let _saveTimer = null;
let _lastSavedAt = null;
let _listeners = [];

export function getState() { return _state; }
export function getUI() { return _ui; }
export function getLastSavedAt() { return _lastSavedAt; }

export function loadAll() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        // Fresh visitor (no saved schedule) → boot into the populated demo.
        _state = raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : buildDemoState();
        // Deep-merge settings so new defaults aren't wiped by old saves
        _state.settings = { ...DEFAULT_STATE.settings, ..._state.settings };
        _state.settings.sessions = { ...DEFAULT_STATE.settings.sessions, ..._state.settings.sessions };
        // Migrate: groups created before session field was added default to AM
        if (_state.groups.some(g => !g.session)) {
            _state.groups = _state.groups.map(g => ({ ...g, session: g.session || 'AM' }));
        }
        // Migrate: groups created before dayOfWeek field was added default to Monday
        if (_state.groups.some(g => g.dayOfWeek === undefined)) {
            _state.groups = _state.groups.map(g => ({ ...g, dayOfWeek: g.dayOfWeek ?? 1 }));
        }
        // Migrate: staff.groupId → staffGroupLinks table
        if (!_state.staffGroupLinks) _state.staffGroupLinks = [];
        const staffWithGroup = _state.staff.filter(s => s.groupId);
        if (staffWithGroup.length > 0 && _state.staffGroupLinks.length === 0) {
            _state.staffGroupLinks = staffWithGroup.map(s => ({ id: generateId(), staffId: s.id, groupId: s.groupId }));
        }
        if (_state.staff.some(s => s.groupId !== undefined)) {
            _state.staff = _state.staff.map(({ groupId, ...rest }) => rest);
        }
        // Migrate: ensure activities array exists
        if (!_state.activities) _state.activities = [];
        // Sanitize: strip any null/undefined slot entries left by a crashed edit
        Object.keys(_state.settings.sessions).forEach(key => {
            const s = _state.settings.sessions[key];
            if (s?.slots) s.slots = s.slots.filter(sl => typeof sl === 'string' && sl.trim());
        });
    } catch { _state = JSON.parse(JSON.stringify(DEFAULT_STATE)); }

    try {
        const raw = localStorage.getItem(UI_KEY);
        _ui = raw ? { ...defaultUI(_state), ...JSON.parse(raw) } : defaultUI(_state);
    } catch { _ui = defaultUI(_state); }
}

export function setState(partial) {
    _state = { ..._state, ...partial };
    scheduleSave();
    notify();
}

// Updates state and schedules a save without triggering a re-render.
// Use for settings panels that manage their own UI updates.
export function setStateSilent(partial) {
    _state = { ..._state, ...partial };
    scheduleSave();
}

export function setUI(partial) {
    _ui = { ..._ui, ...partial };
    localStorage.setItem(UI_KEY, JSON.stringify(_ui));
    notify();
}

function scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
        localStorage.setItem(STATE_KEY, JSON.stringify(_state));
        _lastSavedAt = Date.now();
        notify();
    }, 300);
}

export function saveNow() {
    clearTimeout(_saveTimer);
    localStorage.setItem(STATE_KEY, JSON.stringify(_state));
    _lastSavedAt = Date.now();
}

export function subscribe(fn) {
    _listeners.push(fn);
    return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function notify() {
    _listeners.forEach(fn => fn());
}

export function resetIdentity() {
    localStorage.removeItem(UI_KEY);
    _ui = defaultUI(_state);
    notify();
}
