// =============================================================
// firebase-config.js — conecta la app con NUESTRO proyecto de Firebase
// Los demás archivos importan "auth" y "db" desde aquí.
// =============================================================

// Traemos 3 piezas del SDK de Firebase desde su CDN (servidor de Google).
// ⚠️ Las 3 deben tener EXACTAMENTE la misma versión, o fallan entre ellas.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Pega aquí el objeto que te dio la consola (paso 4).
const firebaseConfig = {
    apiKey: "AIzaSyA_KH26mnlKfsaxZpIRG9ypjYkHRzSxVpY",
    authDomain: "carpool-uvg-e62d0.firebaseapp.com",
    projectId: "carpool-uvg-e62d0",
    storageBucket: "carpool-uvg-e62d0.firebasestorage.app",
    messagingSenderId: "673213243481",
    appId: "1:673213243481:web:b0c351bac6ee8e72a71148"
};

// Encendemos Firebase con esa configuración...
export const app = initializeApp(firebaseConfig);

// ...y sacamos los dos servicios que vamos a usar.
export const auth = getAuth(app);       // cuentas y contraseñas
export const db   = getFirestore(app);  // base de datos

// Los correos que manda Firebase (verificación, etc.) saldrán en español.
auth.languageCode = 'es';