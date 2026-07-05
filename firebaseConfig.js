import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDTYbDrJ5FsBrUpDYCdWCGYE_oWAKcrmog",
  authDomain: "merloconekapp.firebaseapp.com",
  projectId: "merloconekapp",
  storageBucket: "merloconekapp.firebasestorage.app",
  messagingSenderId: "1016837714848",
  appId: "1:1016837714848:android:74d08e29fd765c27962ac5"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// En React Native, initializeAuth puede fallar en recargas rápidas si ya existe.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch {
  auth = getAuth(app);
}

export { auth };
export const db = getFirestore(app);
export const storage = getStorage(app);