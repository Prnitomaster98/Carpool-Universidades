import { auth } from "./firebase-config.js"
import {
    createUserWithEmailAndPassword,   // crear cuenta
    signInWithEmailAndPassword,       // iniciar sesión
    sendEmailVerification,            // mandar correo de verificación
    updateProfile,                    // guardar el nombre en la cuenta
    signOut,
    onAuthStateChanged,               // avisa si ya hay una sesión abierta
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'

import {db} from "./firebase-config.js"
import {doc, setDoc} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'


const DOMINIO_UNIVERSIDAD = "uvg.edu.gt"
const DOMINIO_PRUEBA = "gmail.com"

const DOMINIOS_PERMITIDOS = [DOMINIO_PRUEBA, DOMINIO_UNIVERSIDAD]


const LARGO_MINIMO_CLAVE = 6;

const formEntrar = document.getElementById('form-entrar');
const formRegistro = document.getElementById('form-registro');
const botonCambiar = document.getElementById('boton-cambiar');
const textoCambiar = document.getElementById('texto-cambiar');
const errorEntrar = document.getElementById('error-entrar');
const errorRegistro = document.getElementById('error-registro');

const entrarCorreo = document.getElementById('entrar-correo');
const entrarClave = document.getElementById('entrar-clave');

const registroNombre = document.getElementById('registro-nombre');
const registroCarrera = document.getElementById('registro-carrera');
const registroCorreo = document.getElementById('registro-correo');
const registroClave = document.getElementById('registro-clave');

const avisoVerificacion = document.getElementById('aviso-verificacion')
const botonReenviar = document.getElementById('boton-reenviar')
const botonEntrar = formEntrar.querySelector('button[type="submit"]')
const botonRegistrar = formRegistro.querySelector('button[type="submit"]')

function correoPermitido(correo) {
    return DOMINIOS_PERMITIDOS.some((dominio) => correo.endsWith('@' + dominio)); // Creo una función lambda que revisa si la terminación del correo es correcta.
}

function mostrarError(parrafoError, campo, mensaje) {
    parrafoError.textContent = mensaje;
    if (campo) {
        campo.setAttribute("aria-invalid", "true")
        campo.focus()
    }
}

function limpiarErrores(formulario, parrafoError) { // La función inversa de la pasada, quita el atributo del css que significa error
    parrafoError.textContent = "";
    formulario.querySelectorAll('input').forEach((campo) => {
        campo.removeAttribute('aria-invalid')
    })
}

function leer(campo) {
    return campo.value.trim() //Es como el strip de python que limpia los espacios al inicio y al final
}

function cambiarFormulario() {
    const estaEnEntrar = !formEntrar.hidden //Esto esta bien cool porque cambia el formulario con un botón sin cambiar de página, solo cambia características del css de hidden y usa el mismo objeto con otros textos
    formEntrar.hidden = estaEnEntrar
    formRegistro.hidden = !estaEnEntrar

    if (estaEnEntrar) {
        textoCambiar.textContent = "¿Ya tienes cuenta?"
        botonCambiar.textContent = 'Entrar'
        registroNombre.focus()
    }
    else {
        textoCambiar.textContent = "¿No tienes cuenta?"
        botonCambiar.textContent = "Regístrate"
        entrarCorreo.focus()
    }
}


function traducirError(codigo) {
    const mensajes = {
        'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/invalid-email': 'Ese correo no tiene un formato válido.',
        'auth/weak-password': 'La contraseña es muy débil. Usa al menos 6 caracteres.',
        'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
        'auth/network-request-failed': 'Sin conexión a internet. Revisa tu red.',
        'auth/operation-not-allowed': 'El registro con correo no está habilitado. (Admin: actívalo en la consola de Firebase.)',
        'permission-denied': 'No tienes permiso para esta acción.',
    }
    // Si el código no está en la lista, muestro un error cualquiera.
    return mensajes[codigo] ?? `Algo salió mal (${codigo}). Intenta de nuevo.`; //Los ?? capturan si lo de antes no existe usa lo de al derecha
}

botonCambiar.addEventListener("click", cambiarFormulario)

formEntrar.addEventListener("submit", async (evento) => {
    evento.preventDefault() // No se recarga la página
    limpiarErrores(formEntrar, errorEntrar) //Limpia algo de antes

    const correo = leer(entrarCorreo).toLowerCase();
    const clave = entrarClave.value //Revisa principalmente que todo este ingresado correctamente junto con el correo

    if (correo === "") {
        return mostrarError(errorEntrar, entrarCorreo, "Escribe tu correo institucional")
    }
    if (!correoPermitido(correo)) {
        return mostrarError(errorEntrar, entrarCorreo, "Usa un correo válido (@uvg.edu.gt)")
    }

    if (clave === "") {
        return mostrarError(errorEntrar, entrarClave, "Ingresa tu contraseña")
    }

    botonEntrar.disabled = true
    try {
        const credencial = await signInWithEmailAndPassword(auth, correo, clave) //El await espera la respuesta de la database de las credenciales
        const usuario = credencial.user

        if (!usuario.emailVerified) {
            avisoVerificacion.hidden = false
            return mostrarError(errorEntrar, null, "Tu correo aún no está verificado. Revisa tu bandeja y spam")
        }

        window.location.href = "app.html"

    } catch (error) {
        mostrarError(errorEntrar, null, traducirError(error.code))
    } finally {
        botonEntrar.disabled = false
    }
})

formRegistro.addEventListener('submit', async (evento) => {
    evento.preventDefault(); //Revisa los datos al crear una nueva cuenta
    limpiarErrores(formRegistro, errorRegistro);

    const nombre = leer(registroNombre);
    const carrera = leer(registroCarrera);
    const correo = leer(registroCorreo).toLowerCase();
    const clave = registroClave.value;

    if (nombre === '') {
        return mostrarError(errorRegistro, registroNombre, 'Ingresa tu nombre.');
    }
    if (carrera === '') {
        return mostrarError(errorRegistro, registroCarrera, 'Ingresa tu carrera.');
    }
    if (!correoPermitido(correo)) {
        return mostrarError(errorRegistro, registroCorreo, 'Solo se aceptan correos @uvg.edu.gt.');
    }
    if (clave.length < LARGO_MINIMO_CLAVE) {
        return mostrarError(errorRegistro, registroClave,
            `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`)
    }

    botonRegistrar.disabled = true
    try {
        const credencial = await createUserWithEmailAndPassword(auth, correo, clave)

        await setDoc(doc(db, "usuarios", credencial.user.uid),{ //Guarda los datos en Firebase
            uid: credencial.user.uid,
            nombre: nombre,
            carrera: carrera,
            esDemo: false,
        })

        await updateProfile(credencial.user, { displayName: nombre })
        await sendEmailVerification(credencial.user) //Todo el proceso de crear una cuenta
        await signOut(auth)

        formRegistro.reset() //regresa a la otra parte despues de ingresar el formulario
        cambiarFormulario()
        entrarCorreo.value = correo
        avisoVerificacion.hidden = false
        errorEntrar.textContent = ""            
        
    } catch (error) {
    mostrarError(errorRegistro, null, traducirError(error.code)) //Muestra el error según la función y el diccionario creado.
} finally {
    botonRegistrar.disabled = false
}
})

botonReenviar.addEventListener('click', async ()=>{
    if (!auth.currentUser){ //Solo si el usuario ya intentó entrar
        return mostrarError(errorEntrar, entrarCorreo, "Primero escribe tu correo y contraseña y envíalos")
    }

    botonReenviar.disabled = true

    try{
        await sendEmailVerification(auth.currentUser)
        errorEntrar.textContent = "Ya te lo enviamos de nuevo!"
    } catch (error){
        mostrarError(errorEntrar, null, traducirError(error.code))
    } finally{
        botonReenviar.disabled = false
    }
})

onAuthStateChanged(auth, (usuario) => {
    if (usuario && usuario.emailVerified) {
        window.location.replace("app.html")
    } //Te cambia de pestaña solo sí estas verificado
})
