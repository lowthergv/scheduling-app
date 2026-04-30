export function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function generateId() {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11);
}

export function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function formatDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateFull(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function todayStr() {
    return new Date().toISOString().split('T')[0];
}

export function offsetDate(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

export function getDayOfWeek(dateStr) {
    return new Date(dateStr + 'T12:00:00').getDay();
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getDayName(dayOfWeek) { return DAY_NAMES[dayOfWeek] ?? ''; }
export function getDayShort(dayOfWeek) { return DAY_SHORT[dayOfWeek] ?? ''; }

// Returns ISO date strings for Mon–Fri of the week containing dateStr
export function getWeekDates(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    return Array.from({ length: 5 }, (_, i) => {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        return day.toISOString().split('T')[0];
    });
}

// Parse a slot string like "9:25 - 9:50" into { startMin, endMin }
export function parseSlotTime(slotStr) {
    if (!slotStr || typeof slotStr !== 'string') return { startMin: 0, endMin: 0 };
    const [startRaw, endRaw] = slotStr.split(' - ');
    if (!startRaw || !endRaw) return { startMin: 0, endMin: 0 };
    return { startMin: toMinutes(startRaw.trim()), endMin: toMinutes(endRaw.trim()) };
}

function toMinutes(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    // Heuristic: hours 1–7 are PM (1pm–7pm), 8–12 are as-is
    const hour = h < 8 ? h + 12 : h;
    return hour * 60 + m;
}

// Returns the index of the currently active slot in the given slots array, or -1
export function getCurrentSlotIndex(slots) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let i = 0; i < slots.length; i++) {
        const { startMin, endMin } = parseSlotTime(slots[i]);
        if (nowMin >= startMin && nowMin < endMin) return i;
    }
    return -1;
}

// Returns 'AM'|'MD'|'PM'|null for which session is currently active
export function getCurrentSession(sessions) {
    for (const [key, { slots }] of Object.entries(sessions)) {
        if (getCurrentSlotIndex(slots) !== -1) return key;
    }
    return null;
}

export function timeAgo(ts) {
    if (!ts) return '';
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 5) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
}
