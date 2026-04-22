// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC1PoNqoC1Lx8Jk87CvGEuHtgXtAw5zaMY",
  authDomain: "pdv-imperio.firebaseapp.com",
  projectId: "pdv-imperio",
  storageBucket: "pdv-imperio.firebasestorage.app",
  messagingSenderId: "954514929511",
  appId: "1:954514929511:web:57db113ff3776e61aca1c2",
  measurementId: "G-RDNQ5BJRDS"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços que vamos usar
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);