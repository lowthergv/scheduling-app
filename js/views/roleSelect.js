import { getState, setUI } from '../state.js';
import { escapeHtml } from '../utils.js';

function getGreeting() {
    const h = new Date().getHours();
    if (h < 5)  return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Good night';
}

const PALETTE = [
    '#3B7DD8','#D4783A','#1A8FA8','#7A52C7',
    '#2A9068','#C44B4B','#B8882A','#B84F8A',
];

function avatarColor(name) {
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i);
    return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name) {
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function renderRoleSelect(container, { onRoleChosen }) {
    const state = getState();
    const allStaff = state.staff.slice().sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = `
        <div class="rs-wrap">
            <div class="rs-card">
                <div class="rs-header">
                    <div class="rs-logo">Pacific<span>Clinics</span></div>
                    <h1 class="rs-greeting">${escapeHtml(getGreeting())}</h1>
                    <p class="rs-tagline">Who are you today?</p>
                </div>

                ${allStaff.length > 5 ? `
                <div class="rs-search-wrap">
                    <svg class="rs-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input id="rs-search" class="rs-search" type="text" placeholder="Search your name…" autocomplete="off" autocorrect="off" spellcheck="false" />
                </div>
                ` : ''}

                <div class="rs-list" id="rs-list">
                    ${buildList(allStaff)}
                </div>

                <div class="rs-footer">
                    <button class="rs-admin-btn" id="rs-admin-btn">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Admin access
                    </button>
                </div>
            </div>
        </div>
    `;

    const listEl = container.querySelector('#rs-list');
    bindList(listEl, onRoleChosen);

    const search = container.querySelector('#rs-search');
    if (search) {
        search.addEventListener('input', () => {
            const q = search.value.trim().toLowerCase();
            const filtered = q ? allStaff.filter(s => s.name.toLowerCase().includes(q)) : allStaff;
            listEl.innerHTML = buildList(filtered);
            bindList(listEl, onRoleChosen);
            if (filtered.length === 1 && q.length > 1) {
                listEl.querySelector('.rs-person')?.classList.add('rs-person--lit');
            }
        });
        search.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            const visible = listEl.querySelectorAll('.rs-person');
            if (visible.length === 1) visible[0].click();
        });
        if (window.matchMedia('(pointer: fine)').matches) {
            setTimeout(() => search.focus(), 350);
        }
    }

    container.querySelector('#rs-admin-btn').addEventListener('click', () => onRoleChosen('admin-pin'));
}

function buildList(staff) {
    if (staff.length === 0) {
        return `<div class="rs-empty">No staff added yet.<br><span>Ask your admin to add staff in Settings.</span></div>`;
    }
    return staff.map((s, i) => {
        const c = avatarColor(s.name);
        const ini = initials(s.name);
        const roleLabel = s.role === 'supervisor' ? 'Supervisor' : 'BT';
        return `
            <button class="rs-person"
                data-id="${escapeHtml(s.id)}"
                data-role="${escapeHtml(s.role)}"
                style="--i:${i};--c:${c};--c10:${c}1a;">
                <div class="rs-avatar" style="background:${c}22;color:${c};border-color:${c}55;">${escapeHtml(ini)}</div>
                <span class="rs-person-name">${escapeHtml(s.name)}</span>
                <span class="rs-role-tag ${s.role === 'supervisor' ? 'rs-role-tag--sup' : ''}">${escapeHtml(roleLabel)}</span>
                <svg class="rs-person-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
        `;
    }).join('');
}

function bindList(listEl, onRoleChosen) {
    listEl.querySelectorAll('.rs-person').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const role = btn.dataset.role;
            if (role === 'supervisor') {
                setUI({ role: 'supervisor', staffId: id });
                onRoleChosen('supervisor');
            } else {
                setUI({ role: 'bt', staffId: id });
                onRoleChosen('bt');
            }
        });
    });
}
