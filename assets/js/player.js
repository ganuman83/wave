import { decryptToBlob } from './crypto.js';

class WavePlayer {
  constructor() {
    this.audio        = new Audio();
    this.queue        = [];
    this.currentIndex = -1;
    this.shuffled     = [];
    this.isShuffled   = false;
    this.repeatMode   = 'none'; // none | one | all
    this.speed        = 1;
    this.blobCache    = new Map(); // songId → objectURL
    this.listeners    = {};

    this.audio.addEventListener('timeupdate',  () => this.emit('timeupdate'));
    this.audio.addEventListener('ended',       () => this._onEnded());
    this.audio.addEventListener('loadedmetadata', () => this.emit('metaloaded'));
    this.audio.addEventListener('waiting',     () => this.emit('buffering', true));
    this.audio.addEventListener('canplay',     () => this.emit('buffering', false));
    this.audio.addEventListener('error',       (e) => this.emit('error', e));
  }

  on(event, fn)  { (this.listeners[event] = this.listeners[event] || []).push(fn); }
  off(event, fn) { this.listeners[event] = (this.listeners[event]||[]).filter(f=>f!==fn); }
  emit(event, data) { (this.listeners[event]||[]).forEach(fn => fn(data)); }

  setQueue(songs, startIndex = 0) {
    this.queue = songs;
    this.shuffled = [...songs];
    if (this.isShuffled) this._shuffleArray(this.shuffled);
    this.currentIndex = startIndex;
    this.emit('queuechange');
  }

  get currentSong() {
    if (!this.queue.length || this.currentIndex < 0) return null;
    const list = this.isShuffled ? this.shuffled : this.queue;
    return list[this.currentIndex] || null;
  }

  async play(song) {
    if (song) {
      const idx = this.queue.findIndex(s => s.id === song.id);
      if (idx !== -1) this.currentIndex = idx;
    }
    const s = this.currentSong;
    if (!s) return;
    this.emit('loading', s);
    try {
      let url = this.blobCache.get(s.id);
      if (!url) {
        const resp = await fetch(s.storageUrl);
        const buf  = await resp.arrayBuffer();
        const blob = await decryptToBlob(buf);
        url = URL.createObjectURL(blob);
        this.blobCache.set(s.id, url);
      }
      this.audio.src = url;
      this.audio.playbackRate = this.speed;
      await this.audio.play();
      this.emit('play', s);
    } catch(e) {
      this.emit('error', e.message);
    }
  }

  pause()  { this.audio.pause(); this.emit('pause'); }
  resume() { this.audio.play();  this.emit('play', this.currentSong); }
  toggle() { this.audio.paused ? this.resume() : this.pause(); }

  async next() {
    const list = this.isShuffled ? this.shuffled : this.queue;
    if (!list.length) return;
    if (this.currentIndex < list.length - 1) {
      this.currentIndex++;
    } else if (this.repeatMode === 'all') {
      this.currentIndex = 0;
    } else return;
    await this.play();
  }

  async prev() {
    if (this.audio.currentTime > 3) { this.seek(0); return; }
    if (this.currentIndex > 0) {
      this.currentIndex--;
      await this.play();
    }
  }

  seek(seconds) { this.audio.currentTime = seconds; }
  setVolume(v)  { this.audio.volume = v; }

  setSpeed(s) {
    this.speed = s;
    this.audio.playbackRate = s;
    this.emit('speedchange', s);
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    if (this.isShuffled) {
      this.shuffled = [...this.queue];
      this._shuffleArray(this.shuffled);
      const cur = this.currentSong;
      if (cur) {
        const i = this.shuffled.findIndex(s => s.id === cur.id);
        if (i > 0) { [this.shuffled[0], this.shuffled[i]] = [this.shuffled[i], this.shuffled[0]]; }
        this.currentIndex = 0;
      }
    }
    this.emit('shufflechange', this.isShuffled);
    return this.isShuffled;
  }

  cycleRepeat() {
    const modes = ['none','one','all'];
    this.repeatMode = modes[(modes.indexOf(this.repeatMode) + 1) % 3];
    this.emit('repeatchange', this.repeatMode);
    return this.repeatMode;
  }

  _onEnded() {
    if (this.repeatMode === 'one') { this.seek(0); this.audio.play(); return; }
    this.next();
    this.emit('ended');
  }

  _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  get currentTime()  { return this.audio.currentTime; }
  get duration()     { return this.audio.duration || 0; }
  get paused()       { return this.audio.paused; }
  get volume()       { return this.audio.volume; }

  async downloadSong(song) {
    try {
      let url = this.blobCache.get(song.id);
      if (!url) {
        const resp = await fetch(song.storageUrl);
        const buf  = await resp.arrayBuffer();
        const blob = await decryptToBlob(buf);
        url = URL.createObjectURL(blob);
        this.blobCache.set(song.id, url);
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = `${song.title} - ${song.singer}.mp3`;
      a.click();
    } catch(e) {
      alert('Download failed: ' + e.message);
    }
  }

  async downloadPlaylist(songs) {
    for (const song of songs) {
      await this.downloadSong(song);
      await new Promise(r => setTimeout(r, 600));
    }
  }

  clearCache() {
    this.blobCache.forEach(url => URL.revokeObjectURL(url));
    this.blobCache.clear();
  }
}

export const player = new WavePlayer();
