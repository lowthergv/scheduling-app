import { loadAll, getState, setState, getUI, setUI, subscribe, resetIdentity } from './state.js';
import { isPinSet, verifyPin, hashPin } from './auth.js';
import { offsetDate, getDayOfWeek, escapeHtml } from './utils.js';
import { autoAssignRooms } from './data.js';
import { renderRoleSelect } from './views/roleSelect.js';
import { renderBTView } from './views/btView.js';
import { renderGrid } from './views/grid.js';
import { openEditPopover, closeEditPopover } from './views/editCell.js';
import { openSettings } from './views/settings.js';

// ===== Init =====
loadAll();
initTheme();

const app = document.getElementById('app');
let _unsubscribe = null;
let _currentRoute = null;
let _aaToast = null;
let _aaToastTimer = null;

function getRouteName() {
    const ui = getUI();
    if (!ui.role) return 'role-select';
    if (ui.role === 'bt' && ui.viewingMaster) return 'master-grid';
    if (ui.role === 'bt') return 'bt-view';
    return 'grid';
}

function mount() {
    if (_unsubscribe) _unsubscribe();
    _unsubscribe = subscribe(mount);

    const newRoute = getRouteName();
    const routeChanged = newRoute !== _currentRoute;
    _currentRoute = newRoute;

    if (routeChanged && document.startViewTransition) {
        document.startViewTransition(() => route());
    } else {
        route();
    }
}

function route() {
    const ui = getUI();

    if (!ui.role) {
        renderRoleSelect(app, { onRoleChosen });
        return;
    }

    if (ui.role === 'bt' && ui.viewingMaster) {
        renderGrid(app, {
            onSwitchSession: s => setUI({ currentSession: s }),
            onChangeDate: n => setUI({ currentDate: offsetDate(getUI().currentDate, n) }),
            onCellClick: () => {},
            onAdminClick: () => {},
            onSettingsClick: () => {},
            onAutoAssign: () => {},
            onSwitchRole: () => setUI({ viewingMaster: false, btSessionFocused: false, btWeekView: false }),
            isAdminMode: false,
            isBTViewing: true,
        });
        return;
    }

    if (ui.role === 'bt') {
        renderBTView(app, {
            onSwitchSession: s => setUI({ currentSession: s, btSessionFocused: true, btWeekView: false }),
            onChangeDate: n => setUI({ currentDate: offsetDate(getUI().currentDate, n), btSessionFocused: false, btWeekView: false }),
            onSwitchRole,
            onViewMaster: () => setUI({ viewingMaster: true }),
            onWeekView: () => setUI({ btWeekView: true }),
            onGoToDate: date => setUI({ currentDate: date, btWeekView: false, btSessionFocused: false }),
        });
        return;
    }

    // supervisor or admin
    renderGrid(app, {
        onSwitchSession: s => setUI({ currentSession: s }),
        onChangeDate: n => setUI({ currentDate: offsetDate(getUI().currentDate, n) }),
        onCellClick: (el, groupId, slotIndex) => {
            openEditPopover(el, groupId, slotIndex, {
                onSaved: () => mount(),
                onClosed: () => {},
            });
        },
        onAdminClick,
        onSettingsClick: (tab) => openSettings(typeof tab === 'string' ? tab : 'Rooms', {
            onClose: () => mount(),
            onChangePIN: () => openPINModal({
                title: 'Change Admin PIN',
                desc: 'Enter a new 6-digit PIN.',
                onSuccess: () => mount(),
                onCancel: () => {},
                isSetup: true,
            }),
        }),
        onAutoAssign: () => {
            const ui = getUI();
            const s = getState();
            const prevIds = new Set(s.masterAssignments.map(a => a.id));
            const { newAssignments, filled, skipped, violations } = autoAssignRooms(s, ui.currentSession, getDayOfWeek(ui.currentDate));
            const addedIds = new Set(newAssignments.filter(a => !prevIds.has(a.id)).map(a => a.id));
            setState({ masterAssignments: newAssignments });
            showAutoAssignToast({
                filled, skipped, violations,
                onUndo: () => {
                    const curr = getState();
                    setState({ masterAssignments: curr.masterAssignments.filter(a => !addedIds.has(a.id)) });
                },
            });
        },
        onSwitchRole,
        isAdminMode: ui.isAdminMode,
        isBTViewing: false,
    });
}

// ===== Role routing =====
function onRoleChosen(role) {
    if (role === 'bt') {
        mount();
    } else if (role === 'supervisor') {
        setUI({ role: 'supervisor', isAdminMode: false });
    } else if (role === 'admin-pin') {
        openPINModal({
            title: 'Admin Login',
            desc: 'Enter your PIN to access edit mode.',
            onSuccess: () => {
                setUI({ role: 'admin', isAdminMode: true });
            },
            onCancel: () => {},
            isSetup: !isPinSet(getState()),
        });
    }
}

function onSwitchRole() {
    closeEditPopover();
    resetIdentity();
}

// ===== Admin toggle =====
function onAdminClick() {
    const ui = getUI();
    if (ui.isAdminMode) {
        setUI({ isAdminMode: false });
        closeEditPopover();
    } else {
        openPINModal({
            title: 'Admin Login',
            desc: 'Enter your PIN to access edit mode.',
            onSuccess: () => setUI({ isAdminMode: true }),
            onCancel: () => {},
            isSetup: !isPinSet(getState()),
        });
    }
}

// ===== PIN Modal =====
function openPINModal({ title, desc, onSuccess, onCancel, isSetup = false }) {
    const modal = document.getElementById('pin-modal');
    const titleEl = document.getElementById('pin-modal-title');
    const descEl = document.getElementById('pin-modal-desc');
    const dotsEl = document.getElementById('pin-dots');
    const padEl = document.getElementById('pin-pad');
    const errorEl = document.getElementById('pin-error');
    const cancelBtn = document.getElementById('pin-cancel-btn');

    errorEl.textContent = '';

    let pin = '';
    let firstPin = '';
    // phase: 'verify' | 'enter' (setup first entry) | 'confirm' (setup second entry)
    let phase = isSetup ? 'enter' : 'verify';

    function updateDesc() {
        if (!isSetup) {
            titleEl.textContent = title;
            descEl.textContent = desc;
        } else if (phase === 'enter') {
            titleEl.textContent = 'Set Admin PIN';
            descEl.textContent = 'Choose a 6-digit PIN.';
        } else {
            titleEl.textContent = 'Confirm PIN';
            descEl.textContent = 'Enter the same PIN again.';
        }
    }

    function renderDots() {
        dotsEl.innerHTML = Array.from({ length: 6 }, (_, i) => `
            <div class="pin-dot ${i < pin.length ? 'filled' : ''}"></div>
        `).join('');
    }

    function buildPad() {
        const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
        padEl.innerHTML = keys.map(k => k === ''
            ? `<div></div>`
            : `<button class="pin-key" data-key="${k}">${k}</button>`
        ).join('');
        padEl.querySelectorAll('.pin-key').forEach(btn => {
            btn.addEventListener('click', () => handleKey(btn.dataset.key));
        });
    }

    async function handleKey(key) {
        errorEl.textContent = '';
        if (key === '⌫') {
            pin = pin.slice(0, -1);
            renderDots();
            return;
        }
        if (pin.length >= 6) return;
        pin += key;
        renderDots();
        if (pin.length < 6) return;

        if (phase === 'verify') {
            const state = getState();
            if (!isPinSet(state)) { closePINModal(); onSuccess(); return; }
            const ok = await verifyPin(pin, state.settings.pin);
            if (ok) {
                closePINModal(); onSuccess();
            } else {
                errorEl.textContent = 'Incorrect PIN. Try again.';
                pin = '';
                renderDots();
            }
        } else if (phase === 'enter') {
            firstPin = pin;
            pin = '';
            phase = 'confirm';
            updateDesc();
            renderDots();
        } else if (phase === 'confirm') {
            if (pin === firstPin) {
                const hash = await hashPin(pin);
                const s = getState();
                setState({ settings: { ...s.settings, pin: hash } });
                closePINModal();
                onSuccess();
            } else {
                errorEl.textContent = 'PINs don\'t match. Try again.';
                pin = ''; firstPin = '';
                phase = 'enter';
                updateDesc();
                renderDots();
            }
        }
    }

    updateDesc();
    buildPad();
    renderDots();

    modal.classList.add('open');

    function closePINModal() {
        modal.classList.remove('open');
        pin = ''; firstPin = '';
        dotsEl.style.display = '';
        padEl.innerHTML = '';
        dotsEl.innerHTML = '';
        errorEl.textContent = '';
        cancelBtn.removeEventListener('click', onCancelClick);
        document.removeEventListener('keydown', keyHandler);
    }

    function onCancelClick() { closePINModal(); onCancel(); }
    cancelBtn.addEventListener('click', onCancelClick);

    const keyHandler = e => {
        if (e.key === 'Escape') { closePINModal(); onCancel(); return; }
        if (/^[0-9]$/.test(e.key)) { e.preventDefault(); handleKey(e.key); return; }
        if (e.key === 'Backspace') { e.preventDefault(); handleKey('⌫'); }
    };
    document.addEventListener('keydown', keyHandler);
}

// ===== Theme =====
function initTheme() {
    const saved = localStorage.getItem('scheduler_theme');
    const preferred = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', saved || preferred);
}

// ===== Auto-assign toast =====
function showAutoAssignToast({ filled, skipped, violations = [], onUndo }) {
    if (_aaToast) { _aaToast.remove(); _aaToast = null; }
    clearTimeout(_aaToastTimer);

    const hasViolations = violations.length > 0;
    const DURATION = 8000;

    // Aggregate violations by group+type
    const vMap = {};
    violations.forEach(v => {
        const k = `${v.groupId}:${v.type}`;
        if (!vMap[k]) vMap[k] = { groupName: v.groupName, type: v.type, count: 0 };
        vMap[k].count++;
    });
    const vList = Object.values(vMap);

    const titleText = filled === 0
        ? (skipped > 0 ? `${skipped} group${skipped !== 1 ? 's' : ''} couldn't be placed` : 'Nothing to assign')
        : `${filled} slot${filled !== 1 ? 's' : ''} assigned${skipped > 0 ? ` · ${skipped} skipped` : ''}`;

    const subText = hasViolations
        ? `${violations.length} rule violation${violations.length !== 1 ? 's' : ''} — tap Details`
        : (filled > 0 ? 'All constraints satisfied' : 'All slots already filled');

    const warn = hasViolations || filled === 0;
    const checkIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    const warnIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const infoIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    const toast = document.createElement('div');
    toast.className = 'aa-toast';
    toast.innerHTML = `
        <div class="aa-toast-timer${warn ? ' warn' : ''}" style="animation:aa-timer-drain ${DURATION}ms linear forwards;"></div>
        <div class="aa-toast-strip${warn ? ' warn' : ''}"></div>
        <div class="aa-toast-main">
            <div class="aa-toast-icon${warn ? ' warn' : ''}">
                ${hasViolations ? warnIcon : filled > 0 ? checkIcon : infoIcon}
            </div>
            <div class="aa-toast-content">
                <div class="aa-toast-title">${escapeHtml(titleText)}</div>
                <div class="aa-toast-sub">${escapeHtml(subText)}</div>
            </div>
            <div class="aa-toast-btns">
                ${hasViolations ? `<button class="aa-toast-btn" id="aa-details">Details</button>` : ''}
                ${filled > 0 ? `<button class="aa-toast-btn aa-toast-btn--undo" id="aa-undo">Undo</button>` : ''}
                <button class="aa-toast-btn aa-toast-btn--close" id="aa-close" aria-label="Dismiss">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        </div>
        ${hasViolations && vList.length > 0 ? `
        <div class="aa-toast-violations" id="aa-violations">
            <div class="aa-toast-violations-inner">
                ${vList.map(v => `
                    <div class="aa-toast-violation">
                        <div class="aa-toast-violation-dot"></div>
                        <span><strong>${escapeHtml(v.groupName)}</strong>: ${v.type === 'gym-overflow'
                            ? `forced into ${v.count > 1 ? v.count + ' extra' : 'a second'} gym slot`
                            : `same room repeated 3+ times${v.count > 1 ? ` (×${v.count})` : ''}`
                        }</span>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}
    `;

    document.body.appendChild(toast);
    _aaToast = toast;

    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));

    const dismiss = () => {
        toast.classList.add('dismissed');
        setTimeout(() => { if (_aaToast === toast) _aaToast = null; toast.remove(); }, 350);
        clearTimeout(_aaToastTimer);
    };

    _aaToastTimer = setTimeout(dismiss, DURATION);

    toast.querySelector('#aa-close').addEventListener('click', dismiss);
    toast.querySelector('#aa-undo')?.addEventListener('click', () => { onUndo(); dismiss(); });
    toast.querySelector('#aa-details')?.addEventListener('click', () => {
        toast.querySelector('#aa-violations').classList.toggle('open');
    });
}

// ===== Start =====
mount();
