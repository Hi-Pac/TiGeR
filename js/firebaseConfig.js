// Firebase configuration and initialization.
// This file is used to initialize the Firebase app using the provided
// configuration. It exposes commonly used services on the `window`
// object so that other modules can access them without re‑initializing.

const firebaseConfig = {
  apiKey: "AIzaSyBRtCWX-OcFAtMqZusMqePMX2zvlIdcRyA",
  authDomain: "delta-hcp-fa2ba.firebaseapp.com",
  projectId: "delta-hcp-fa2ba",
  storageBucket: "delta-hcp-fa2ba.firebasestorage.app",
  messagingSenderId: "649732241434",
  appId: "1:649732241434:web:f3adddc04c9b6e9d2f39a3",
  measurementId: "G-G3JEXBE9KZ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export commonly used services to global scope for easy access.
window.auth = firebase.auth();
window.db = firebase.firestore();
window.storage = firebase.storage();