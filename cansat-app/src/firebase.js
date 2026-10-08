import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJrSVmewSQsu_U-ImfeAaBLmIFqHUJUQ",
  authDomain: "cansat-3bfmetallican.firebaseapp.com",
  projectId: "cansat-3bfmetallican",
  storageBucket: "cansat-3bfmetallican.firebasestorage.app",
  messagingSenderId: "1087060400122",
  appId: "1:1087060400122:web:4acd135a840505cc4bb643",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);