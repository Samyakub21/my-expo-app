// Firebase v9 configuration for React Native/Expo
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
// @ts-ignore - React Native specific persistence
import { getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase App - only initialize once
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth with platform-specific persistence
let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(app);
} else {
  // React Native - use initializeAuth with AsyncStorage for persistence
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // If auth is already initialized (hot reload), get existing instance
    auth = getAuth(app);
  }
}

// Initialize Firestore
const db = getFirestore(app);

// Initialize Functions
const functions = getFunctions(app, "us-central1");

export {
  auth, createUserWithEmailAndPassword, db, deleteUser, functions, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithEmailAndPassword,
  // Auth functions
  signOut, updateProfile
};

