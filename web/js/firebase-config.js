// Obtengo las keys de firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Claves de acceso que me dió firebase
const firebaseConfig = {
    apiKey: "AIzaSyA_KH26mnlKfsaxZpIRG9ypjYkHRzSxVpY",
    authDomain: "carpool-uvg-e62d0.firebaseapp.com",
    projectId: "carpool-uvg-e62d0", 
    storageBucket: "carpool-uvg-e62d0.firebasestorage.app",
    messagingSenderId: "673213243481",
    appId: "1:673213243481:web:b0c351bac6ee8e72a71148"
};

// Inicializo firebase con mi configuraciones para que accese
export const app = initializeApp(firebaseConfig);

// Estos son los servicios que voy a usar.
export const auth = getAuth(app);       // cuentas y contraseñas
export const db   = getFirestore(app);  // base de datos

// Correos que manda son en español
auth.languageCode = 'es';