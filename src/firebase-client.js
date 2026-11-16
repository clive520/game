import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase, onDisconnect, onValue, push, ref, remove, set } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { collection, getDocs, getFirestore, limit, orderBy, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { firebaseAppCheckSiteKey, firebaseConfig, firebaseFunctionRegion, isFirebaseConfigured } from "./firebase-config.js";

let client;

export async function initializeFirebaseClient() {
  if (!isFirebaseConfigured()) return { configured: false };
  if (!client) {
    const app = initializeApp(firebaseConfig);
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(firebaseAppCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    const auth = getAuth(app);
    const database = getDatabase(app);
    const firestore = getFirestore(app);
    const functions = getFunctions(app, firebaseFunctionRegion);
    client = { app, auth, database, firestore, functions };
  }
  if (!client.auth.currentUser) {
    const authCallable = httpsCallable(client.functions, "threeKingdomsAuthenticate");
    const result = await authCallable({});
    if (result.data.customToken) await signInWithCustomToken(client.auth, result.data.customToken);
  }
  return { configured: true, ...client, uid: client.auth.currentUser.uid };
}

export async function callServer(name, payload) {
  const ready = await initializeFirebaseClient();
  if (!ready.configured) throw new Error("尚未設定 Firebase 專案。");
  const functionName = `threeKingdoms${name[0].toUpperCase()}${name.slice(1)}`;
  const callable = httpsCallable(ready.functions, functionName);
  const result = await callable(payload);
  return result.data;
}

export async function subscribeRoom(roomId, onRoom, onError) {
  const ready = await initializeFirebaseClient();
  if (!ready.configured) throw new Error("尚未設定 Firebase 專案。");
  return onValue(ref(ready.database, `threeKingdoms/rooms/${roomId}/public`), (snapshot) => {
    onRoom(snapshot.val());
  }, onError);
}

export async function monitorRoomPresence(roomId, uid, onError) {
  const ready = await initializeFirebaseClient();
  if (!ready.configured) throw new Error("尚未設定 Firebase 專案。");
  const connectionsRef = ref(ready.database, `threeKingdoms/presence/${roomId}/${uid}`);
  const liveConnections = new Set();
  const stopWatching = onValue(ref(ready.database, ".info/connected"), async (snapshot) => {
    if (snapshot.val() !== true) return;
    const connectionRef = push(connectionsRef);
    try {
      await onDisconnect(connectionRef).remove();
      await set(connectionRef, true);
      liveConnections.add(connectionRef);
    } catch (error) {
      onError?.(error);
    }
  }, onError);
  return async () => {
    stopWatching();
    await Promise.allSettled([...liveConnections].map((connectionRef) => remove(connectionRef)));
  };
}

export async function loadPublicMatches(maxItems = 30) {
  const ready = await initializeFirebaseClient();
  if (!ready.configured) throw new Error("尚未設定 Firebase 專案。");
  const matches = collection(ready.firestore, "threeKingdomsMatches");
  const recent = query(
    matches,
    where("status", "in", ["completed", "draw", "interrupted"]),
    orderBy("endedAt", "desc"),
    limit(maxItems),
  );
  const snapshot = await getDocs(recent);
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

export async function loadMatchEvents(matchId) {
  const ready = await initializeFirebaseClient();
  if (!ready.configured) throw new Error("尚未設定 Firebase 專案。");
  const events = collection(ready.firestore, "threeKingdomsMatches", matchId, "events");
  const ordered = query(events, orderBy("sequence", "asc"));
  const snapshot = await getDocs(ordered);
  return snapshot.docs.map((document) => document.data());
}
