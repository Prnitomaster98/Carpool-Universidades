import {auth} from './firebase-config.js'
import { onAuthStateChanged, signOut}
from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'

//Ayuda a esperar y manejar la sesión abierta. Regresa al login si no hay una sesión.

export function protegerPagina(){
    return new Promise((resolve)=>{ //Promise es un tipo de función que entrega una respuesta después de cuando se llama, resolve es quien la entrega o como.
        onAuthStateChanged(auth, (usuario)=>{
            if (!usuario || !usuario.emailVerified){
                window.location.replace('index.html')
                return
            }
            resolve(usuario)
        })
    })
}

export async function cerrarSesion(){
    await signOut(auth)
    window.location.replace('index.html')
}