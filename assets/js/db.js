import { db, auth } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── Songs ──────────────────────────────────────────────
export async function getAllSongs() {
  const snap = await getDocs(query(collection(db, 'songs'), orderBy('uploadedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSongsByCategory(category) {
  const snap = await getDocs(query(
    collection(db, 'songs'),
    where('categories', 'array-contains', category),
    orderBy('uploadedAt', 'desc')
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function searchSongs(term) {
  const all = await getAllSongs();
  const t = term.toLowerCase();
  return all.filter(s =>
    s.title?.toLowerCase().includes(t) ||
    s.singer?.toLowerCase().includes(t) ||
    s.album?.toLowerCase().includes(t)
  );
}

export async function addSong(songData) {
  return addDoc(collection(db, 'songs'), {
    ...songData,
    uploadedAt: serverTimestamp()
  });
}

export async function deleteSong(songId) {
  await deleteDoc(doc(db, 'songs', songId));
}

// ── Liked Songs ────────────────────────────────────────
export async function getLikedSongs(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().liked || [];
}

export async function toggleLike(uid, songId) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const liked = snap.exists() ? (snap.data().liked || []) : [];
  const isLiked = liked.includes(songId);
  if (snap.exists()) {
    await updateDoc(ref, { liked: isLiked ? arrayRemove(songId) : arrayUnion(songId) });
  } else {
    await setDoc(ref, { liked: [songId] });
  }
  return !isLiked;
}

// ── Playlists ──────────────────────────────────────────
export async function getUserPlaylists(uid) {
  const snap = await getDocs(query(
    collection(db, 'playlists'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc')
  ));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createPlaylist(uid, name) {
  return addDoc(collection(db, 'playlists'), {
    userId: uid,
    name,
    songIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updatePlaylist(playlistId, data) {
  await updateDoc(doc(db, 'playlists', playlistId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function deletePlaylist(playlistId) {
  await deleteDoc(doc(db, 'playlists', playlistId));
}

export async function addSongToPlaylist(playlistId, songId) {
  await updateDoc(doc(db, 'playlists', playlistId), {
    songIds: arrayUnion(songId),
    updatedAt: serverTimestamp()
  });
}

export async function removeSongFromPlaylist(playlistId, songId) {
  await updateDoc(doc(db, 'playlists', playlistId), {
    songIds: arrayRemove(songId),
    updatedAt: serverTimestamp()
  });
}
