import {auth} from './firebase-config.js'
import { onAuthStateChanged, signOut}
from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'



export function protegerPagina(){
    return new Promise((resolve)=>{ 
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