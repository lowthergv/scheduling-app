// Demo data for the public/static build. When there's no saved schedule yet
// (a fresh visitor), the app boots into this populated example so the grid
// isn't empty. A real clinic clears it and enters their own.
//
// All names are fictional; clients are shown as initials only.

const BTS = ["Maya R.", "Jordan K.", "Tyrese W.", "Priya S.", "Sam D.", "Alex M."];
const CLIENT_INITIALS = [
  "A.B.", "C.D.", "E.F.", "G.H.", "J.K.",
  "L.M.", "N.P.", "R.S.", "T.W.", "V.X.", "B.C.", "D.E.",
];
const SESSIONS = ["AM", "MD", "PM"];
const ROOMS = ["Room 1", "Room 2", "Room 3", "Gym", "Art Room", "Sensory Room"];

const SESSION_SLOTS = {
  AM: ["9:00 - 9:25", "9:25 - 9:50", "9:50 - 10:15", "10:15 - 10:40", "10:40 - 11:05", "11:05 - 11:30", "11:30 - 11:55", "11:55 - 12:15"],
  MD: ["12:30 - 12:55", "12:55 - 1:20", "1:20 - 1:45", "1:45 - 2:10", "2:10 - 2:30"],
  PM: ["3:30 - 3:55", "3:55 - 4:20", "4:20 - 4:45", "4:45 - 5:10", "5:10 - 5:30"],
};

export function buildDemoState() {
  let counter = 0;
  const id = (p) => `${p}${++counter}`;

  const staff = BTS.map((name) => ({ id: id("s"), name, role: "BT" }));

  const groups = [];
  const staffGroupLinks = [];
  const clients = [];
  const masterAssignments = [];

  // Weekly recurring master schedule: Monday (1) through Friday (5).
  for (let day = 1; day <= 5; day++) {
    for (const session of SESSIONS) {
      const slots = SESSION_SLOTS[session];
      // One team per technician, every session, every weekday — so no one's
      // day is ever empty in the demo.
      for (let t = 0; t < staff.length; t++) {
        const bt = staff[t];
        const group = { id: id("g"), name: bt.name, session, dayOfWeek: day };
        groups.push(group);
        staffGroupLinks.push({ id: id("l"), staffId: bt.id, groupId: group.id });

        // One client per team for this session.
        const ci = (t + day * 2 + (session === "MD" ? 4 : session === "PM" ? 8 : 0)) % CLIENT_INITIALS.length;
        clients.push({
          id: id("c"),
          name: CLIENT_INITIALS[ci],
          staffId: bt.id,
          groupId: group.id,
        });

        // Place each team in a distinct room per slot (rotating, no collisions).
        slots.forEach((_, slotIndex) => {
          const roomName = ROOMS[(t + slotIndex) % ROOMS.length];
          masterAssignments.push({
            id: id("m"),
            groupId: group.id,
            dayOfWeek: day,
            session,
            timeSlotIndex: slotIndex,
            roomName,
          });
        });
      }
    }
  }

  return {
    settings: {
      pin: null,
      rooms: ROOMS,
      sessions: {
        AM: { slots: SESSION_SLOTS.AM },
        MD: { slots: SESSION_SLOTS.MD },
        PM: { slots: SESSION_SLOTS.PM },
      },
    },
    groups,
    staff,
    staffGroupLinks,
    clients,
    masterAssignments,
    overrides: [],
    activities: [],
  };
}
