/* stride-data.jsx — mock data for the Stride prototype. Globals via window. */

// route/track geometry in 0..100 viewBox space
const PATHS = {
  riverside: 'M 22 78 C 14 64 18 50 30 46 C 44 41 40 26 54 24 C 70 22 78 32 76 46 C 74 60 60 60 56 70 C 52 80 36 86 22 78 Z',
  hilltop:   'M 24 82 C 30 66 26 52 40 48 C 56 43 58 30 72 26 L 80 22',
  harbor:    'M 14 30 C 26 24 38 30 44 42 C 50 54 64 54 70 44 C 76 34 88 36 90 50 C 92 64 80 72 66 70 C 50 68 46 78 32 76 C 20 74 16 60 24 52',
  forest:    'M 18 24 C 34 18 36 34 50 36 C 66 38 64 22 78 26 C 88 29 86 46 74 52 C 60 59 70 74 56 80 C 42 86 36 70 24 70 C 14 70 12 54 22 48 C 30 43 24 32 18 24',
  bridge:    'M 16 70 L 32 66 C 44 63 46 50 58 48 L 72 45 C 84 42 86 28 80 20',
  // a recorded track that mostly follows riverside but wanders a bit
  track1:    'M 23 77 C 16 64 19 50 31 47 C 45 43 41 27 54 25 C 69 23 77 33 75 47 C 73 60 59 61 55 70 C 51 79 37 84 23 77',
  freeRun:   'M 20 76 C 28 70 24 56 36 54 C 50 52 48 38 60 38 C 74 38 72 56 62 60 C 50 65 56 78 42 80 C 30 82 26 84 20 76',
};

const USER = {
  name: 'Maya Okafor', email: 'maya@stride.run', handle: 'mayaruns',
  avatarColor: '#FF4D2E', units: 'metric',
  totals: { distance: 842.6, time: '78h 14m', count: 186, elevation: 9240 },
};

const ATHLETES = {
  maya: { name: 'Maya Okafor', color: '#FF4D2E' },
  devon: { name: 'Devon Hart', color: '#5B8CFF' },
  priya: { name: 'Priya Nair', color: '#00E07A' },
  luca: { name: 'Luca Romano', color: '#FFB020' },
  sana: { name: 'Sana Yilmaz', color: '#C879FF' },
  theo: { name: 'Theo Bauer', color: '#21D4C4' },
  noor: { name: 'Noor Aziz', color: '#FF6FB5' },
};

const ROUTES = [
  { id: 'riverside', name: 'Riverside Loop', dist: 8.4, elev: 62, owner: 'maya', role: 'OWNER',
    members: 6, isPublic: true, loop: true, seed: 7, path: PATHS.riverside, liveNow: 2,
    updated: '2d ago', desc: 'Flat waterfront loop along the east bank. Great for tempo work.' },
  { id: 'bridge', name: 'Bridge Crossing', dist: 6.1, elev: 40, owner: 'maya', role: 'OWNER',
    members: 3, isPublic: false, loop: false, seed: 21, path: PATHS.bridge, liveNow: 0,
    updated: '5d ago', desc: 'Point-to-point across the old steel bridge and back through downtown.' },
  { id: 'hilltop', name: 'Hilltop Sprint', dist: 3.2, elev: 145, owner: 'devon', role: 'MEMBER',
    members: 9, isPublic: true, loop: false, seed: 33, path: PATHS.hilltop, liveNow: 1,
    updated: '1d ago', desc: 'Short, brutal climb. 145m of gain in under 3.5k.' },
  { id: 'harbor', name: 'Harbor 10K', dist: 10.0, elev: 28, owner: 'priya', role: 'MEMBER',
    members: 14, isPublic: true, loop: true, seed: 52, path: PATHS.harbor, liveNow: 0,
    updated: '1w ago', desc: 'Classic harbor 10K. Mostly flat, a few cobbled sections.' },
  { id: 'forest', name: 'Forest Park Trail', dist: 12.6, elev: 320, owner: 'luca', role: 'INVITED',
    members: 5, isPublic: false, loop: true, seed: 64, path: PATHS.forest, liveNow: 0,
    updated: '3d ago', desc: 'Rolling singletrack through the north woods. Bring trail shoes.' },
];

const INVITES = [
  { routeId: 'forest', route: 'Forest Park Trail', from: 'luca', dist: 12.6 },
];

const ACTIVITIES = [
  { id: 'a1', title: 'Morning Riverside', type: 'RUN', date: 'Today · 6:42 AM', ts: 'Today',
    dist: 8.42, dur: '42:18', durS: 2538, pace: '5:01', elev: 64, routeId: 'riverside',
    seed: 7, track: PATHS.track1, route: PATHS.riverside,
    pr: false, rank: 4, of: 28, synced: true,
    splits: [ ['1', '4:52', 86], ['2', '4:58', 78], ['3', '5:06', 64], ['4', '5:12', 52],
              ['5', '4:49', 92], ['6', '5:03', 70], ['7', '5:08', 60], ['8', '4:55', 84],
              ['0.42', '2:06', 66] ] },
  { id: 'a2', title: 'Tempo Tuesday', type: 'RUN', date: 'Tue · 6:10 PM', ts: 'Tue',
    dist: 6.10, dur: '28:44', durS: 1724, pace: '4:43', elev: 41, routeId: 'bridge',
    seed: 21, track: PATHS.bridge, route: PATHS.bridge, pr: true, rank: 1, of: 12, synced: true,
    splits: [ ['1', '4:38', 90], ['2', '4:41', 84], ['3', '4:47', 70], ['4', '4:45', 76],
              ['5', '4:40', 88], ['6', '4:44', 78], ['0.10', '0:29', 60] ] },
  { id: 'a3', title: 'Easy Shakeout', type: 'JOG', date: 'Mon · 7:20 AM', ts: 'Mon',
    dist: 4.30, dur: '24:50', durS: 1490, pace: '5:46', elev: 22, routeId: null,
    seed: 88, track: PATHS.freeRun, route: null, pr: false, synced: true,
    splits: [ ['1', '5:40', 70], ['2', '5:48', 62], ['3', '5:52', 56], ['4', '5:44', 66], ['0.30', '1:46', 58] ] },
  { id: 'a4', title: 'Long Sunday', type: 'RUN', date: 'Sun · 8:00 AM', ts: 'Sun',
    dist: 16.20, dur: '1:24:36', durS: 5076, pace: '5:13', elev: 188, routeId: null,
    seed: 41, track: PATHS.harbor, route: null, pr: false, synced: false,
    splits: [ ['1', '5:02', 84], ['2', '5:08', 76], ['3', '5:10', 72] ] },
  { id: 'a5', title: 'Recovery Walk', type: 'WALK', date: 'Sat · 5:30 PM', ts: 'Sat',
    dist: 3.10, dur: '34:12', durS: 2052, pace: '11:02', elev: 12, routeId: null,
    seed: 12, track: PATHS.freeRun, route: null, pr: false, synced: true,
    splits: [ ['1', '10:50', 60], ['2', '11:04', 56], ['3', '11:12', 52], ['0.10', '1:06', 50] ] },
];

const LEADERBOARD = [
  { athlete: 'priya', time: '38:42', pace: '4:36', date: 'Apr 28', rank: 1 },
  { athlete: 'devon', time: '39:55', pace: '4:45', date: 'May 02', rank: 2 },
  { athlete: 'theo', time: '41:30', pace: '4:56', date: 'Apr 19', rank: 3 },
  { athlete: 'maya', time: '42:18', pace: '5:01', date: 'Today', rank: 4, me: true },
  { athlete: 'sana', time: '43:02', pace: '5:07', date: 'May 01', rank: 5 },
  { athlete: 'luca', time: '44:50', pace: '5:20', date: 'Apr 25', rank: 6 },
  { athlete: 'noor', time: '46:11', pace: '5:30', date: 'Apr 30', rank: 7 },
];

const MEMBERS = [
  { athlete: 'maya', role: 'OWNER', status: 'JOINED' },
  { athlete: 'devon', role: 'MEMBER', status: 'JOINED' },
  { athlete: 'priya', role: 'MEMBER', status: 'JOINED' },
  { athlete: 'theo', role: 'MEMBER', status: 'JOINED' },
  { athlete: 'sana', role: 'MEMBER', status: 'INVITED' },
  { athlete: 'noor', role: 'MEMBER', status: 'DECLINED' },
];

// live runners on the riverside route (positions in % space, progress along route)
const LIVE_RUNNERS = [
  { athlete: 'devon', x: 54, y: 24, dist: 6.2, elapsed: '31:12', pace: '5:02', progress: 74, online: true },
  { athlete: 'priya', x: 76, y: 46, dist: 4.1, elapsed: '19:40', pace: '4:48', progress: 49, online: true },
  { athlete: 'theo', x: 30, y: 46, dist: 1.8, elapsed: '9:22', pace: '5:12', progress: 21, online: false },
];

function fmtKm(km, u = 'metric') { return u === 'imperial' ? (km * 0.621371).toFixed(2) : km.toFixed(2); }
function distUnit(u) { return u === 'imperial' ? 'mi' : 'km'; }

Object.assign(window, {
  PATHS, USER, ATHLETES, ROUTES, INVITES, ACTIVITIES, LEADERBOARD, MEMBERS, LIVE_RUNNERS,
  fmtKm, distUnit,
});
