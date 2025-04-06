import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBSqxJUrz40v93N3EnEJ94Xh5kllJUfqtU",
  authDomain: "sinktheship-8cc92.firebaseapp.com",
  projectId: "sinktheship-8cc92",
  storageBucket: "sinktheship-8cc92.firebasestorage.app",
  messagingSenderId: "97711472769",
  appId: "1:97711472769:web:adc24c7e953867cf21cd80"
};

// Initialisera Firebase
const app = initializeApp(firebaseConfig);

// Få auth instans
export const auth = getAuth(app);

// Få Firestore instans
export const db = getFirestore(app);

export default app; 