import { onAuth, logout } from './auth.js';
import { player } from './player.js';
import {
  getAllSongs, getSongsByCategory, searchSongs,
  getLikedSongs, toggleLike,
  getUserPlaylists, createPlaylist, updatePlaylist, deletePlaylist,
  addSongToPlaylist, removeSongFromPlaylist
} from './db.js';
import { ADMIN_EMAILS } from './firebase-config.js';

// ── State ─────────────────────────────────────────────────────────────
let currentUser   = null;
let allSongs      = [];
let likedIds      = new Set();
let playlists     = [];
let currentView   = 'all';   // all | liked | playlist:<id> | category:<name>
let currentCat    = 'All';
let isAdmin       = false;
let ctxSong       = null;

const CATEGORIES = ['All', 'Hindi', 'English', 'Marathi', 'Gym', 'God'];

// ── Boot ──────────────────────────────────────────────────────────────
onAuth(async user => {
  if (!user) { window.location.href = 'index.html'; return; }
  currentUser = user;
  isAdmin = ADMIN_EMAILS.includes(user.email);

  // Set user info
  const name = user.displayName || user.email.split('@')[0];
  document.getElementById('userName').textContent = name;
  const av = document.getElementById('userAvatar');
  if (user.photoURL) av.innerHTML = `<img src="${user.photoURL}" alt="">`;
  else av.textContent = name[0].toUpperCase();

  if (isAdmin) {
    document.getElementById('uploadLink').style.display = 'flex';
  }

  await Promise.all([loadSongs(), loadLiked(), loadPlaylists()]);
  renderView();
  setupPlayer();
});

// ── Data loaders ──────────────────────────────────────────────────────
async function loadSongs() {
  showLoading();
  try {
    allSongs = await getAllSongs();
  } catch(e) { console.error(e); }
}

async function loadLiked() {
  const ids = await getLikedSongs(currentUser.uid);
  likedIds = new Set(ids);
}

async function loadPlaylists() {
  playlists = await getUserPlaylists(currentUser.uid);
  renderSidebar();
}

// ── Render ────────────────────────────────────────────────────────────
function showLoading() {
  document.getElementById('songsContainer').innerHTML = `
    <div class="loading-wrap"><div class="spinner"></div><span>Loading songs…</span></div>`;
}

function renderView() {
  // Category tabs
  document.querySelectorAll('.cat-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === currentCat);
  });

  let songs = allSongs;
  let title = 'All Songs';

  if (currentView === 'liked') {
    songs = allSongs.filter(s => likedIds.has(s.id));
    title = 'Liked Songs';
    document.getElementById('viewTitle').textContent = title;
    renderSongList(songs);
    return;
  }

  if (currentView.startsWith('playlist:')) {
    const plId = currentView.split(':')[1];
    const pl   = playlists.find(p => p.id === plId);
    if (!pl) { currentView = 'all'; renderView(); return; }
    songs = (pl.songIds || []).map(id => allSongs.find(s => s.id === id)).filter(Boolean);
    renderPlaylistView(pl, songs);
    return;
  }

  if (currentCat !== 'All') {
    songs = allSongs.filter(s => s.categories?.includes(currentCat));
    title = currentCat;
  }

  document.getElementById('viewTitle').textContent = title;
  renderSongGrid(songs);
}

function renderSongGrid(songs) {
  const el = document.getElementById('songsContainer');
  if (!songs.length) {
    el.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      <p>No songs here yet.</p></div>`; return;
  }
  el.innerHTML = `<div class="songs-grid">${songs.map(songCard).join('')}</div>`;
}

function renderSongList(songs) {
  const el = document.getElementById('songsContainer');
  if (!songs.length) {
    el.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      <p>No songs here yet.</p></div>`; return;
  }
  el.innerHTML = `<div class="songs-list">${songs.map((s, i) => songRow(s, i + 1)).join('')}</div>`;
}

function renderPlaylistView(pl, songs) {
  const el = document.getElementById('songsContainer');
  el.innerHTML = `
    <div class="playlist-header">
      <div class="playlist-cover">
        ${songs[0]?.thumbnailUrl
          ? `<img src="${songs[0].thumbnailUrl}" alt="">`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`}
      </div>
      <div class="playlist-meta">
        <div class="playlist-label">Playlist</div>
        <div class="playlist-name">${esc(pl.name)}</div>
        <div class="playlist-info">${songs.length} song${songs.length !== 1 ? 's' : ''}</div>
        <div class="playlist-actions">
          <button class="pl-play-btn" onclick="playAll()">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="icon-btn" title="Download Playlist" onclick="downloadPlaylist()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          <button class="icon-btn" title="Edit playlist" onclick="editPlaylist('${pl.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="icon-btn danger" title="Delete playlist" onclick="confirmDeletePlaylist('${pl.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    </div>
    <div class="view-title" id="viewTitle">${esc(pl.name)}</div>
    <div class="songs-list">${songs.map((s, i) => songRow(s, i + 1, pl.id)).join('')}</div>`;
}

function songCard(song) {
  const liked = likedIds.has(song.id);
  const thumb = song.thumbnailUrl
    ? `<img src="${song.thumbnailUrl}" alt="" loading="lazy">`
    : `<div class="song-thumb-placeholder">🎵</div>`;
  return `<div class="song-card" onclick="playSong('${song.id}')" oncontextmenu="openCtx(event,'${song.id}')">
    <div class="song-thumb">
      ${thumb}
      <button class="card-play-btn" onclick="event.stopPropagation();playSong('${song.id}')">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
    </div>
    <div class="song-title">${esc(song.title)}</div>
    <div class="song-meta">${esc(song.singer || '')}${song.album ? ' · ' + esc(song.album) : ''}</div>
  </div>`;
}

function songRow(song, num, playlistId = null) {
  const liked = likedIds.has(song.id);
  const isPlaying = player.currentSong?.id === song.id;
  const thumb = song.thumbnailUrl
    ? `<img src="${song.thumbnailUrl}" alt="" loading="lazy">`
    : `<div class="song-row-thumb-placeholder">🎵</div>`;
  return `<div class="song-row ${isPlaying ? 'playing' : ''}" onclick="playSong('${song.id}')" oncontextmenu="openCtx(event,'${song.id}')">
    <div class="song-row-num">${isPlaying ? '▶' : num}</div>
    <div style="display:flex;align-items:center;gap:12px;min-width:0;">
      <div class="song-row-thumb">${thumb}</div>
      <div class="song-row-info">
        <div class="song-row-title">${esc(song.title)}</div>
        <div class="song-row-meta">${esc(song.singer || '')}${song.album ? ' · ' + esc(song.album) : ''}</div>
      </div>
    </div>
    <div class="song-row-actions">
      <button class="icon-btn ${liked ? 'liked' : ''}" onclick="event.stopPropagation();handleLike('${song.id}')" title="Like">
        <svg viewBox="0 0 24 24" ${liked ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"'}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </button>
      <button class="icon-btn" onclick="event.stopPropagation();downloadSong('${song.id}')" title="Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      ${playlistId ? `<button class="icon-btn" onclick="event.stopPropagation();removeSongFromPL('${playlistId}','${song.id}')" title="Remove from playlist">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>` : ''}
    </div>
  </div>`;
}

function renderSidebar() {
  const el = document.getElementById('playlistItems');
  el.innerHTML = playlists.map(pl => `
    <div class="pl-item ${currentView === 'playlist:' + pl.id ? 'active' : ''}" onclick="openPlaylist('${pl.id}')">
      <div class="pl-thumb">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="pl-info">
        <div class="pl-name">${esc(pl.name)}</div>
        <div class="pl-count">${(pl.songIds||[]).length} songs</div>
      </div>
    </div>`).join('');
}

// ── Playback ──────────────────────────────────────────────────────────
window.playSong = function(songId) {
  const song = allSongs.find(s => s.id === songId);
  if (!song) return;

  let list = allSongs;
  if (currentView === 'liked') list = allSongs.filter(s => likedIds.has(s.id));
  else if (currentView.startsWith('playlist:')) {
    const pl = playlists.find(p => p.id === currentView.split(':')[1]);
    if (pl) list = (pl.songIds||[]).map(id => allSongs.find(s => s.id === id)).filter(Boolean);
  } else if (currentCat !== 'All') {
    list = allSongs.filter(s => s.categories?.includes(currentCat));
  }

  player.setQueue(list, list.findIndex(s => s.id === songId));
  player.play();
};

window.playAll = function() {
  if (allSongs.length) { player.setQueue(allSongs, 0); player.play(); }
};

window.downloadSong = function(songId) {
  const song = allSongs.find(s => s.id === songId);
  if (song) player.downloadSong(song);
};

window.downloadPlaylist = function() {
  if (!currentView.startsWith('playlist:')) return;
  const pl = playlists.find(p => p.id === currentView.split(':')[1]);
  if (!pl) return;
  const songs = (pl.songIds||[]).map(id => allSongs.find(s => s.id === id)).filter(Boolean);
  player.downloadPlaylist(songs);
};

// ── Likes ─────────────────────────────────────────────────────────────
window.handleLike = async function(songId) {
  const now = await toggleLike(currentUser.uid, songId);
  if (now) likedIds.add(songId);
  else likedIds.delete(songId);
  renderView();
  updatePlayerLikeBtn();
};

// ── Playlists ─────────────────────────────────────────────────────────
window.showCreatePlaylist = function() {
  openModal('New Playlist', '', async (name) => {
    if (!name.trim()) return;
    await createPlaylist(currentUser.uid, name.trim());
    await loadPlaylists();
  });
};

window.openPlaylist = function(id) {
  currentView = 'playlist:' + id;
  closeSidebar();
  renderView();
  renderSidebar();
};

window.editPlaylist = function(id) {
  const pl = playlists.find(p => p.id === id);
  if (!pl) return;
  openModal('Rename Playlist', pl.name, async (name) => {
    if (!name.trim()) return;
    await updatePlaylist(id, { name: name.trim() });
    await loadPlaylists();
    renderView();
  });
};

window.confirmDeletePlaylist = function(id) {
  if (confirm('Delete this playlist? Songs won\'t be removed.')) {
    deletePlaylist(id).then(() => {
      currentView = 'all';
      loadPlaylists().then(renderView);
    });
  }
};

window.removeSongFromPL = async function(plId, songId) {
  await removeSongFromPlaylist(plId, songId);
  await loadPlaylists();
  renderView();
};

// ── Context menu ──────────────────────────────────────────────────────
const ctxMenu = document.getElementById('ctxMenu');

window.openCtx = function(e, songId) {
  e.preventDefault();
  ctxSong = allSongs.find(s => s.id === songId);
  if (!ctxSong) return;

  const liked = likedIds.has(songId);

  // Build playlist submenu items
  const plItems = playlists.map(pl =>
    `<div class="ctx-item" onclick="addToPlaylist('${pl.id}','${songId}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      ${esc(pl.name)}
    </div>`).join('');

  ctxMenu.innerHTML = `
    <div class="ctx-item" onclick="playSong('${songId}'); closeCtx()">
      <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M8 5v14l11-7z"/></svg> Play
    </div>
    <div class="ctx-item" onclick="handleLike('${songId}'); closeCtx()">
      <svg viewBox="0 0 24 24" ${liked ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"'} width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      ${liked ? 'Unlike' : 'Like'}
    </div>
    <div class="ctx-item" onclick="downloadSong('${songId}'); closeCtx()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download
    </div>
    ${playlists.length ? '<div class="ctx-sep"></div>' + plItems : ''}
    ${isAdmin ? `<div class="ctx-sep"></div>
    <div class="ctx-item danger" onclick="adminDeleteSong('${songId}'); closeCtx()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
      Delete Song
    </div>` : ''}`;

  const x = Math.min(e.clientX, window.innerWidth - 200);
  const y = Math.min(e.clientY, window.innerHeight - ctxMenu.scrollHeight - 10);
  ctxMenu.style.left = x + 'px';
  ctxMenu.style.top  = y + 'px';
  ctxMenu.classList.add('open');
};

window.closeCtx = function() { ctxMenu.classList.remove('open'); };
document.addEventListener('click', () => closeCtx());

window.addToPlaylist = async function(plId, songId) {
  await addSongToPlaylist(plId, songId);
  await loadPlaylists();
  closeCtx();
};

window.adminDeleteSong = async function(songId) {
  if (!isAdmin) return;
  if (!confirm('Permanently delete this song?')) return;
  const { deleteSong } = await import('./db.js');
  await deleteSong(songId);
  allSongs = allSongs.filter(s => s.id !== songId);
  renderView();
};

// ── Search ────────────────────────────────────────────────────────────
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim();
  if (!q) { renderView(); return; }
  searchTimeout = setTimeout(async () => {
    const results = await searchSongs(q);
    document.getElementById('viewTitle').textContent = `Search: "${q}"`;
    renderSongGrid(results);
  }, 300);
});

// ── Category tabs ─────────────────────────────────────────────────────
window.setCat = function(cat) {
  currentCat  = cat;
  currentView = 'all';
  renderView();
};

// ── Nav ───────────────────────────────────────────────────────────────
window.goHome = function() {
  currentView = 'all';
  currentCat  = 'All';
  renderView();
  renderSidebar();
  closeSidebar();
};

window.goLiked = function() {
  currentView = 'liked';
  closeSidebar();
  renderView();
  renderSidebar();
};

// ── Sidebar toggle (mobile) ───────────────────────────────────────────
window.toggleSidebar = function() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
};

window.closeSidebar = function() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
};

document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

// ── Player UI ─────────────────────────────────────────────────────────
function setupPlayer() {
  player.on('play', updatePlayerUI);
  player.on('pause', () => {
    document.getElementById('playPauseBtn').innerHTML = playIcon();
    syncMiniPlayer(true);
  });
  player.on('timeupdate', updateProgress);
  player.on('loading', s => {
    document.getElementById('playerTitle').textContent = 'Loading…';
  });
  player.on('error', msg => console.error('Player error:', msg));

  // Progress bar click
  const track = document.getElementById('progressTrack');
  track.addEventListener('click', e => {
    const pct = e.offsetX / track.offsetWidth;
    player.seek(pct * player.duration);
  });

  // Volume
  document.getElementById('volumeSlider').addEventListener('input', e => {
    player.setVolume(e.target.value / 100);
  });
}

function updatePlayerUI(song) {
  if (!song) return;
  document.getElementById('playerTitle').textContent = song.title;
  document.getElementById('playerMeta').textContent  = `${song.singer || ''}${song.album ? ' · ' + song.album : ''}`;
  document.getElementById('playPauseBtn').innerHTML  = pauseIcon();
  document.getElementById('playPauseBtn').classList.add('playing');

  const th = document.getElementById('playerThumb');
  if (song.thumbnailUrl) th.innerHTML = `<img src="${song.thumbnailUrl}" alt="">`;
  else th.innerHTML = `<div class="player-thumb-placeholder">🎵</div>`;

  updatePlayerLikeBtn();
  updateQueueUI();
  syncMiniPlayer(false);
}

function updatePlayerLikeBtn() {
  const btn = document.getElementById('playerLikeBtn');
  const song = player.currentSong;
  if (!song) return;
  const liked = likedIds.has(song.id);
  btn.classList.toggle('liked', liked);
  btn.innerHTML = `<svg viewBox="0 0 24 24" ${liked ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2"'}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  // sync mini like btn
  const mlb = document.getElementById('miniLikeBtn');
  if (mlb) {
    mlb.classList.toggle('liked', liked);
    mlb.innerHTML = btn.innerHTML;
  }
}

function updateProgress() {
  const pct = player.duration ? (player.currentTime / player.duration) * 100 : 0;
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressThumb').style.right = (100 - pct) + '%';
  document.getElementById('timeNow').textContent  = fmt(player.currentTime);
  document.getElementById('timeTot').textContent  = fmt(player.duration);
  // sync mini progress bar every tick
  const mpf = document.getElementById('miniProgressFill');
  if (mpf) mpf.style.width = pct + '%';
}

function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

// Player button handlers
window.togglePlay    = () => player.toggle();
window.prevSong      = () => player.prev();
window.nextSong      = () => player.next();
window.toggleShuffle = () => {
  const on = player.toggleShuffle();
  document.getElementById('shuffleBtn').classList.toggle('active', on);
};
window.toggleRepeat  = () => {
  const mode = player.cycleRepeat();
  const btn  = document.getElementById('repeatBtn');
  btn.classList.toggle('active', mode !== 'none');
  btn.title = mode === 'one' ? 'Repeat one' : mode === 'all' ? 'Repeat all' : 'Repeat off';
};

window.cycleSpeed = () => {
  const speeds = [1, 1.25, 1.5, 0.75];
  const cur = speeds.indexOf(player.speed);
  const next = speeds[(cur + 1) % speeds.length];
  player.setSpeed(next);
  document.getElementById('speedBtn').textContent = next + 'x';
};

window.playerLike = async () => {
  const song = player.currentSong;
  if (!song) return;
  await handleLike(song.id);
};

window.toggleQueue = () => {
  document.getElementById('queuePanel').classList.toggle('open');
  updateQueueUI();
};

window.closeQueue = () => document.getElementById('queuePanel').classList.remove('open');

function updateQueueUI() {
  const list = player.isShuffled ? player.shuffled : player.queue;
  const cur  = player.currentSong;
  document.getElementById('queueList').innerHTML = list.map((s, i) => `
    <div class="queue-item ${cur?.id === s.id ? 'current' : ''}" onclick="player.setQueue(list,${i}); player.play()">
      <div class="queue-item-thumb">
        ${s.thumbnailUrl ? `<img src="${s.thumbnailUrl}" alt="">` : '🎵'}
      </div>
      <div class="queue-item-info">
        <div class="queue-item-title">${esc(s.title)}</div>
        <div class="queue-item-meta">${esc(s.singer || '')}</div>
      </div>
    </div>`).join('');
}

// ── Modal ─────────────────────────────────────────────────────────────
function openModal(title, defaultVal, onConfirm) {
  document.getElementById('modalTitle').textContent  = title;
  document.getElementById('modalInput').value        = defaultVal;
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalInput').focus();
  window._modalConfirm = async () => {
    const v = document.getElementById('modalInput').value;
    await onConfirm(v);
    closeModal();
  };
}

window.closeModal   = () => document.getElementById('modalOverlay').classList.remove('open');
window.confirmModal = () => window._modalConfirm?.();

document.getElementById('modalInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') window.confirmModal();
  if (e.key === 'Escape') window.closeModal();
});

// ── Logout ────────────────────────────────────────────────────────────
window.handleLogout = async () => {
  await logout();
  window.location.href = 'index.html';
};

// ── Helpers ───────────────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function playIcon()  { return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`; }
function pauseIcon() { return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; }

export { allSongs, likedIds, playlists, currentUser, isAdmin };

// ── Mini player sync (mobile) ─────────────────────────────────────────
function syncMiniPlayer(paused) {
  if (typeof window._updateMiniPlayer !== 'function') return;
  const song = player.currentSong;
  if (!song) return;
  const pct = player.duration ? (player.currentTime / player.duration) * 100 : 0;
  window._updateMiniPlayer({
    song,
    paused: paused !== undefined ? paused : !player.isPlaying,
    liked: likedIds.has(song.id),
    progress: pct
  });
}
