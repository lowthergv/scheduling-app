import { getState, getUI, setState } from '../state.js';
import { escapeHtml, generateId, getDayOfWeek } from '../utils.js';
import { resolveAssignment, getActiveSlots, getRoomColor } from '../data.js';

let _popover = null;
let _outsideHandler = null;
let _keyHandler = null;
let _acIdx = -1;

export function openEditPopover(anchorEl, groupId, slotIndex, { onSaved, onClosed }) {
    closeEditPopover();

    const state = getState();
    const ui = getUI();
    const slots = getActiveSlots(state, ui.currentSession);
    const existing = resolveAssignment(state, groupId, ui.currentDate, ui.currentSession, slotIndex);

    _popover = document.getElementById('edit-popover');
    _popover.classList.remove('hidden');

    const groupName = state.groups.find(g => g.id === groupId)?.name ?? '';

    _popover.innerHTML = `
        <div class="edit-popover-header">${escapeHtml(groupName)} · ${escapeHtml(slots[slotIndex] ?? '')}</div>

        <div class="popover-room-input">
            <input type="text" id="pop-room-input" placeholder="Room name…" autocomplete="off" value="${existing ? escapeHtml(existing.roomName) : ''}" />
            <div class="autocomplete-list hidden" id="pop-ac-list"></div>
        </div>

        <div class="popover-actions">
            ${existing ? `<button class="btn btn-danger" id="pop-clear-btn">Clear</button>` : ''}
            <button class="btn btn-primary" id="pop-save-btn">Save</button>
        </div>
    `;

    positionPopover(anchorEl);

    const input = _popover.querySelector('#pop-room-input');
    const acList = _popover.querySelector('#pop-ac-list');

    input.focus();
    input.select();

    input.addEventListener('input', () => {
        _acIdx = -1;
        updateAutocomplete(input.value, acList, state.settings.rooms);
    });
    input.addEventListener('focus', () => {
        if (!input.value.trim()) updateAutocomplete('', acList, state.settings.rooms);
    });
    input.addEventListener('keydown', e => {
        const items = acList.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') { e.preventDefault(); _acIdx = Math.min(_acIdx + 1, items.length - 1); highlightAC(items); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); _acIdx = Math.max(_acIdx - 1, -1); highlightAC(items); }
        else if (e.key === 'Enter') { e.preventDefault(); if (_acIdx >= 0 && items[_acIdx]) { input.value = items[_acIdx].dataset.value; acList.classList.add('hidden'); } else { doSave(); } }
        else if (e.key === 'Escape') { closeEditPopover(); onClosed?.(); }
    });

    acList.addEventListener('click', e => {
        const item = e.target.closest('.autocomplete-item');
        if (item) { input.value = item.dataset.value; acList.classList.add('hidden'); input.focus(); }
    });

    _popover.querySelector('#pop-clear-btn')?.addEventListener('click', () => doSave(''));
    _popover.querySelector('#pop-save-btn').addEventListener('click', () => doSave());

    function doSave(forcedRoom) {
        const roomName = forcedRoom !== undefined ? forcedRoom : input.value.trim();
        const freshState = getState();
        const freshUI = getUI();
        const dayOfWeek = getDayOfWeek(freshUI.currentDate);

        let newMaster = freshState.masterAssignments.filter(a => !(
            a.groupId === groupId && a.dayOfWeek === dayOfWeek &&
            a.session === freshUI.currentSession && a.timeSlotIndex === slotIndex
        ));
        if (roomName) {
            newMaster.push({ id: generateId(), groupId, dayOfWeek, session: freshUI.currentSession, timeSlotIndex: slotIndex, roomName });
        }

        setState({ masterAssignments: newMaster });
        closeEditPopover();
        onSaved?.();
    }

    // Dismiss on outside click
    _outsideHandler = e => {
        if (!_popover.contains(e.target) && e.target !== anchorEl) {
            closeEditPopover();
            onClosed?.();
        }
    };
    setTimeout(() => document.addEventListener('mousedown', _outsideHandler), 0);

    _keyHandler = e => {
        if (e.key === 'Escape') { closeEditPopover(); onClosed?.(); }
    };
    document.addEventListener('keydown', _keyHandler);
}

export function closeEditPopover() {
    if (_popover) {
        _popover.classList.add('hidden');
        _popover.innerHTML = '';
    }
    if (_outsideHandler) { document.removeEventListener('mousedown', _outsideHandler); _outsideHandler = null; }
    if (_keyHandler) { document.removeEventListener('keydown', _keyHandler); _keyHandler = null; }
    _acIdx = -1;
}

function updateAutocomplete(query, list, rooms) {
    const q = query.toLowerCase();
    const matches = q
        ? rooms.filter(r => r.toLowerCase().includes(q) && r.toLowerCase() !== q)
        : rooms;

    if (matches.length === 0) { list.classList.add('hidden'); return; }
    list.classList.remove('hidden');
    list.innerHTML = matches.map(r => `
        <div class="autocomplete-item" data-value="${escapeHtml(r)}">
            <div class="autocomplete-dot" style="background:${getRoomColor(r)}"></div>
            ${escapeHtml(r)}
        </div>
    `).join('');
}

function highlightAC(items) {
    items.forEach((el, i) => el.classList.toggle('selected', i === _acIdx));
    if (_acIdx >= 0 && items[_acIdx]) {
        items[_acIdx].scrollIntoView({ block: 'nearest' });
    }
}

function positionPopover(anchor) {
    const rect = anchor.getBoundingClientRect();
    const pw = 240;
    const margin = 8;
    let left = rect.left + rect.width / 2 - pw / 2;
    let top = rect.bottom + margin;

    // Keep within viewport
    if (left + pw > window.innerWidth - margin) left = window.innerWidth - pw - margin;
    if (left < margin) left = margin;
    if (top + 300 > window.innerHeight) top = rect.top - 300 - margin;

    _popover.style.left = `${left}px`;
    _popover.style.top = `${top}px`;
    _popover.style.width = `${pw}px`;
}
