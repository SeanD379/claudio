import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SNAPSHOT_PATH = new URL('./playlist-snapshot.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const API_URL = process.env.MUSIC_API_URL || 'http://localhost:3002';

const PLAYLISTS = [
  { originalId: 13695193341, name: '华语4.0' },
  { originalId: 13139605087, name: '外放英文' },
  { originalId: 9393371452, name: '国语2.0' },
  { originalId: 8736018140, name: '粤语' },
  { originalId: 8598742641, name: '2.0' },
  { originalId: 3178575601, name: 'Acoustic' },
  { originalId: 698199921, name: '1.0' },
  { originalId: 633657071, name: '白龙介喜欢的音乐' },
];

function getCookie() {
  try {
    const cookiePath = resolve(process.cwd(), '..', '.netease-cookie');
    return readFileSync(cookiePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

async function fetchPlaylist(playlistId, cookie) {
  const cookieParam = cookie ? `&cookie=${encodeURIComponent(cookie)}` : '';
  const response = await fetch(`${API_URL}/playlist/detail?id=${playlistId}${cookieParam}`);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  const playlist = data.playlist;
  if (!playlist) throw new Error('Playlist not found');
  return (playlist.tracks || []).map(t => ({
    id: t.id,
    name: t.name,
    artist: (t.ar || []).map(a => a.name).join('/'),
  }));
}

// Load snapshot
if (!existsSync(SNAPSHOT_PATH)) {
  console.error('Snapshot not found: ' + SNAPSHOT_PATH);
  process.exit(1);
}
const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf-8'));
const cookie = getCookie();

const changes = [];
const fetchedData = {};
let totalAdded = 0;
let totalRemoved = 0;

for (const pl of PLAYLISTS) {
  process.stderr.write('Checking: ' + pl.name + '...\n');
  try {
    const currentTracks = await fetchPlaylist(pl.originalId, cookie);
    fetchedData[pl.originalId] = currentTracks;
    const oldTracks = snapshot.playlists[pl.originalId]?.tracks || [];

    const oldIds = new Set(oldTracks.map(t => t.id));
    const newIds = new Set(currentTracks.map(t => t.id));

    const added = currentTracks.filter(t => !oldIds.has(t.id));
    const removed = oldTracks.filter(t => !newIds.has(t.id));

    if (added.length > 0 || removed.length > 0) {
      changes.push({
        playlist: pl.name,
        playlistId: pl.originalId,
        added: added.map(t => ({ name: t.name, artist: t.artist })),
        removed: removed.map(t => ({ name: t.name, artist: t.artist })),
      });
      totalAdded += added.length;
      totalRemoved += removed.length;
    }
  } catch (err) {
    process.stderr.write(`  Error: ${err.message}\n`);
    fetchedData[pl.originalId] = snapshot.playlists[pl.originalId]?.tracks || [];
  }
}

// Output result
const result = {
  checkTime: new Date().toISOString(),
  hasChanges: changes.length > 0,
  summary: { totalAdded, totalRemoved, playlistsChanged: changes.length },
  changes,
};
console.log(JSON.stringify(result, null, 2));

// Update snapshot
const newSnapshot = { timestamp: new Date().toISOString(), playlists: {} };
for (const pl of PLAYLISTS) {
  newSnapshot.playlists[pl.originalId] = { name: pl.name, tracks: fetchedData[pl.originalId] };
}
writeFileSync(SNAPSHOT_PATH, JSON.stringify(newSnapshot, null, 2), 'utf-8');
if (changes.length > 0) process.stderr.write('Snapshot updated with changes.\n');
else process.stderr.write('No changes. Snapshot timestamp updated.\n');
