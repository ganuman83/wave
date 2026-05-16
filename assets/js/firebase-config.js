import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBOy1h-2gv7bVtWuUiEYaHw8d7Us5ggC1c",
  authDomain: "wave-927e3.firebaseapp.com",
  projectId: "wave-927e3",
  storageBucket: "wave-927e3.firebasestorage.app",
  messagingSenderId: "287353982346",
  appId: "1:287353982346:web:bead2be413462414e10c73"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Cloudinary config
export const CLOUDINARY = {
  cloudName: "drbxaxlzm",
  audioPreset: "wave_uploads",
  thumbPreset: "wave_thumbnails",
  uploadUrl: "https://api.cloudinary.com/v1_1/drbxaxlzm/raw/upload",
  imageUploadUrl: "https://api.cloudinary.com/v1_1/drbxaxlzm/image/upload"
};

export const ADMIN_EMAILS = ["ganeshchindarkar84@gmail.com"];
