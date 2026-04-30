import { getDayOfWeek } from './utils.js';

// Room color palette — muted, readable on both themes
const ROOM_PALETTE = [
    '#3B7DD8', // Blue
    '#D4783A', // Orange
    '#1A8FA8', // Cyan
    '#7A52C7', // Violet
    '#2A9068', // Emerald
    '#C44B4B', // Red
    '#B8882A', // Amber
    '#B84F8A', // Pink
    '#2A8C85', // Teal
    '#5B57C2', // Indigo
];
const _roomColorCache = {};
let _nextColorIdx = 0;

export function getRoomColor(roomName) {
    if (!roomName) return 'var(--accent)';
    if (!_roomColorCache[roomName]) {
        _roomColorCache[roomName] = ROOM_PALETTE[_nextColorIdx % ROOM_PALETTE.length];
        _nextColorIdx++;
    }
    return _roomColorCache[roomName];
}

// Returns the assignment for a given cell, or null.
// Checks overrides first, then master. Override with roomName='' = explicitly cleared.
export function resolveAssignment(state, groupId, date, session, slotIndex) {
    const override = state.overrides.find(o =>
        o.groupId === groupId && o.date === date &&
        o.session === session && o.timeSlotIndex === slotIndex
    );
    if (override !== undefined) {
        return override.roomName ? override : null;
    }
    const dow = getDayOfWeek(date);
    return state.masterAssignments.find(a =>
        a.groupId === groupId && a.dayOfWeek === dow &&
        a.session === session && a.timeSlotIndex === slotIndex
    ) ?? null;
}

// Returns the activity for a given cell, or null (empty string = explicitly cleared).
export function resolveActivity(state, groupId, date, session, slotIndex) {
    const activity = (state.activities ?? []).find(a =>
        a.groupId === groupId && a.date === date &&
        a.session === session && a.timeSlotIndex === slotIndex
    );
    return activity ? activity.activity : null;
}

export function getGroupsForSession(state, session) {
    return state.groups.filter(g => g.session === session);
}

// Returns groups for a specific session + day of week
export function getGroupsForDay(state, session, dayOfWeek) {
    return state.groups.filter(g => g.session === session && g.dayOfWeek === dayOfWeek);
}

export function getGroupStaff(state, groupId) {
    const staffIds = (state.staffGroupLinks ?? []).filter(l => l.groupId === groupId).map(l => l.staffId);
    return state.staff.filter(s => staffIds.includes(s.id));
}

export function getActiveSlots(state, session) {
    return state.settings.sessions[session]?.slots ?? [];
}

export function getStaffById(state, staffId) {
    return state.staff.find(s => s.id === staffId) ?? null;
}

export function getGroupById(state, groupId) {
    return state.groups.find(g => g.id === groupId) ?? null;
}

// Returns all groups a staff member is linked to
export function getStaffGroups(state, staffId) {
    const links = (state.staffGroupLinks ?? []).filter(l => l.staffId === staffId);
    return links.map(l => getGroupById(state, l.groupId)).filter(Boolean);
}

// Returns the group for a staff member in a specific session + day, or null
export function getBTGroupForSession(state, staffId, session, dayOfWeek) {
    const links = (state.staffGroupLinks ?? []).filter(l => l.staffId === staffId);
    for (const link of links) {
        const group = getGroupById(state, link.groupId);
        if (!group) continue;
        if (group.session !== session) continue;
        if (dayOfWeek !== undefined && group.dayOfWeek !== dayOfWeek) continue;
        return group;
    }
    return null;
}

// Returns the first group a BT is linked to, or null
export function getBTGroup(state, staffId) {
    const link = (state.staffGroupLinks ?? []).find(l => l.staffId === staffId);
    return link ? getGroupById(state, link.groupId) : null;
}

// Fills empty slots for a session+day prioritizing room diversity & balance.
//
// Hard constraints (violated only as last resort):
//   1. Gym rooms: each group gets at most 1 gym slot total.
//   2. Consecutive limit: group may not use same room 3+ slots in a row.
//   3. Soft 1-consecutive: prefer different room each slot; allow 2 if needed.
//
// Strategy: maximize diversity (avoid reusing rooms), balance room types, maintain coverage.
// overlapRules: { [roomName]: maxConcurrent } — unlisted rooms default to 1.
// Returns { filled, groups, skipped, newAssignments, violations }.
export function autoAssignRooms(state, session, dayOfWeek) {
    const groups = state.groups.filter(g => g.session === session && g.dayOfWeek === dayOfWeek);
    const rooms = state.settings.rooms;
    const slots = state.settings.sessions[session]?.slots ?? [];
    const overlapRules = state.settings.extras?.overlapRules ?? {};

    if (rooms.length === 0 || groups.length === 0 || slots.length === 0) {
        return { filled: 0, groups: groups.length, skipped: 0, newAssignments: state.masterAssignments, violations: [] };
    }

    const newAssignments = [...state.masterAssignments];
    let filled = 0;
    let skipped = 0;
    const violations = [];

    // Per-group tracking
    const roomHistory = {};   // groupId → roomName[] by slotIndex
    const gymUsed = {};       // groupId → bool (max 1 gym per group)
    const roomCount = {};     // groupId → { roomName: count }
    const typeCount = {};     // groupId → { typeId: count }

    groups.forEach(g => {
        roomHistory[g.id] = new Array(slots.length).fill(null);
        gymUsed[g.id] = false;
        roomCount[g.id] = {};
        typeCount[g.id] = {};
    });

    newAssignments.forEach(a => {
        if (a.session !== session || a.dayOfWeek !== dayOfWeek || !roomHistory[a.groupId]) return;
        roomHistory[a.groupId][a.timeSlotIndex] = a.roomName;
        const type = getRoomType(a.roomName);
        roomCount[a.groupId][a.roomName] = (roomCount[a.groupId][a.roomName] ?? 0) + 1;
        typeCount[a.groupId][type] = (typeCount[a.groupId][type] ?? 0) + 1;
        if (type === 'gym') gymUsed[a.groupId] = true;
    });

    slots.forEach((_, slotIndex) => {
        const slotLoad = {};
        const slotTypeLoad = {};
        newAssignments.forEach(a => {
            if (a.dayOfWeek === dayOfWeek && a.session === session && a.timeSlotIndex === slotIndex) {
                const type = getRoomType(a.roomName);
                slotLoad[a.roomName] = (slotLoad[a.roomName] ?? 0) + 1;
                slotTypeLoad[type] = (slotTypeLoad[type] ?? 0) + 1;
            }
        });

        groups.forEach(group => {
            const existing = newAssignments.find(a =>
                a.groupId === group.id && a.dayOfWeek === dayOfWeek &&
                a.session === session && a.timeSlotIndex === slotIndex
            );
            if (existing) return;

            const hist = roomHistory[group.id];
            const lastRoom  = slotIndex > 0 ? hist[slotIndex - 1] : null;
            const twoBack   = slotIndex > 1 ? hist[slotIndex - 2] : null;
            // Hard block: same room for 3 consecutive slots
            const hardConsecutive = (lastRoom && lastRoom === twoBack) ? lastRoom : null;
            // Soft block: same room as last slot (prefer different, allow if forced)
            const softConsecutive = lastRoom;

            const scored = rooms.map(roomName => {
                const capacity = overlapRules[roomName] ?? 1;
                if ((slotLoad[roomName] ?? 0) >= capacity) return null;

                const type = getRoomType(roomName);
                let hardBlock = null;
                let softBlock = false;

                // Hard constraints
                if (type === 'gym' && gymUsed[group.id]) hardBlock = 'gym-overflow';
                else if (roomName === hardConsecutive) hardBlock = 'consecutive-overflow';

                // Soft constraint
                if (roomName === softConsecutive) softBlock = true;

                // Scoring: prioritize diversity
                const score =
                    -(roomCount[group.id][roomName] ?? 0) * 5          // strong penalty for reusing room
                    - (typeCount[group.id][type] ?? 0) * 1             // mild penalty for reusing type
                    - (slotLoad[roomName] ?? 0) * 0.5                  // load balance
                    - (softBlock ? 10 : 0);                             // soft penalty for back-to-back

                return { roomName, score, hardBlock, softBlock };
            }).filter(Boolean);

            const eligible  = scored.filter(r => !r.hardBlock);
            const softBlocked = scored.filter(r => r.softBlock && !r.hardBlock);
            const hardBlocked = scored.filter(r => r.hardBlock);

            let chosen = null;
            let violationType = null;

            // Preference: eligible (no blocks) > soft blocks (prefer different room but allow back-to-back) > hard blocks
            if (eligible.length > 0) {
                chosen = eligible.reduce((b, r) => r.score > b.score ? r : b);
            } else if (softBlocked.length > 0 || (eligible.length === 0 && scored.filter(r => !r.hardBlock).length > 0)) {
                // No purely eligible rooms, try soft-blocked ones
                const candidates = scored.filter(r => !r.hardBlock);
                if (candidates.length > 0) {
                    chosen = candidates.reduce((b, r) => r.score > b.score ? r : b);
                }
            }

            if (!chosen && hardBlocked.length > 0) {
                // Last resort: use hard-blocked room
                chosen = hardBlocked.reduce((b, r) => r.score > b.score ? r : b);
                violationType = chosen.hardBlock;
            }

            if (!chosen) {
                skipped++;
                return;
            }

            newAssignments.push({
                id: generateIdSimple(),
                groupId: group.id,
                dayOfWeek, session,
                timeSlotIndex: slotIndex,
                roomName: chosen.roomName,
            });
            slotLoad[chosen.roomName] = (slotLoad[chosen.roomName] ?? 0) + 1;
            const type = getRoomType(chosen.roomName);
            slotTypeLoad[type] = (slotTypeLoad[type] ?? 0) + 1;
            roomHistory[group.id][slotIndex] = chosen.roomName;
            roomCount[group.id][chosen.roomName] = (roomCount[group.id][chosen.roomName] ?? 0) + 1;
            typeCount[group.id][type] = (typeCount[group.id][type] ?? 0) + 1;
            filled++;

            if (violationType) {
                violations.push({ groupId: group.id, groupName: group.name, type: violationType, slotIndex });
            }
        });
    });

    return { filled, groups: groups.length, skipped, newAssignments, violations };
}

function getRoomType(name) {
    return typeof name === 'string' && name.toLowerCase().includes('gym') ? 'gym' : 'classroom';
}

function isGymRoom(name) {
    return typeof name === 'string' && name.toLowerCase().includes('gym');
}

function generateIdSimple() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
