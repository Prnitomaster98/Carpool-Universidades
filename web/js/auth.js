const DOMINIO_UNIVERSIDAD = "uvg.edu.gt"
const DOMINIO_PRUEBA = "gmail.com"

const DOMINIOS_PERMITIDOS = [DOMINIO_PRUEBA, DOMINIO_UNIVERSIDAD]


const LARGO_MINIMO_CLAVE = 6;

const formEntrar     = document.getElementById('form-entrar');
const formRegistro   = document.getElementById('form-registro');
const botonCambiar   = document.getElementById('boton-cambiar');
const textoCambiar   = document.getElementById('texto-cambiar');
const errorEntrar    = document.getElementById('error-entrar');
const errorRegistro  = document.getElementById('error-registro');

const entrarCorreo   = document.getElementById('entrar-correo');
const entrarClave    = document.getElementById('entrar-clave');

const registroNombre  = document.getElementById('registro-nombre');
const registroCarrera = document.getElementById('registro-carrera');
const registroCorreo  = document.getElementById('registro-correo');
const registroClave   = document.getElementById('registro-clave');

function correoPermitido(correo){
    return DOMINIOS_PERMITIDOS.some((dominio)=> correo.endsWith('@' + dominio)); // Creo una función lambda que revisa si la terminación del correo es correcta.
}

function mostrarError(parrafoError, campo, mensaje){
    parrafoError.textContent = mensaje;
    if (campo){
        campo.setAttribute("aria-invalid", "true")
        campo.focus()
    }
}

function limpiarErrores(formulario,parrafoError){ // La función inversa de la pasada, quita el atributo del css que significa error
    parrafoError.textContent="";
    formulario.querySelectorAll('input').forEach((campo) =>{
        campo.removeAttribute('aria-invalid')
    })
}

function leer(campo){
    return campo.value.trim() //Es como el strip de python que limpia los espacios al inicio y al final
}

function cambiarFormulario(){
    const estaEnEntrar = !formEntrar.hidden //Esto esta bien cool porque cambia el formulario con un botón sin cambiar de página, solo cambia características del css de hidden y usa el mismo objeto con otros textos
    formEntrar.hidden = estaEnEntrar
    formRegistro.hidden = !estaEnEntrar

    if (estaEnEntrar){
        textoCambiar.textContent = "¿Ya tienes cuenta?"
        botonCambiar.textContent ='Entrar'
        registroNombre.focus()
    }
    else{
        textoCambiar.textContent="¿No tienes cuenta?"
        botonCambiar.textContent="Regístrate"
        entrarCorreo.focus()
    }
}


botonCambiar.addEventListener("click", cambiarFormulario)

formEntrar.addEventListener("submit", (evento)=>{
    evento.preventDefault() // No se recarga la página
    limpiarErrores(formEntrar,errorEntrar) //Limpia algo de antes

    const correo = leer(entrarCorreo).toLowerCase();
    const clave = entrarClave.value

    if (correo===""){
        return mostrarError(errorEntrar, entrarCorreo, "Escribe tu correo institucional")
    }
    if (!correoPermitido(correo)){
        return mostrarError(errorEntrar,entrarCorreo, "Usa un correo válido (@uvg.edu.gt)")
    }
    
    if (clave ===""){
        return mostrarError(errorEntrar, entrarClave, "Ingresa tu contraseña")
    }


    //Acá despues hay que meter a firebase para revisar los datos

    console.log("Entrar con:", correo)
    errorEntrar.textContent = "Datos válidos :) (Después viene Firebase)"
})

formRegistro.addEventListener('submit', (evento) => {
    evento.preventDefault();
    limpiarErrores(formRegistro, errorRegistro);

    const nombre  = leer(registroNombre);
    const carrera = leer(registroCarrera);
    const correo  = leer(registroCorreo).toLowerCase();
    const clave   = registroClave.value;

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
    `La contraseña debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`);
    }

  //    En la Etapa 5 aquí crearemos la cuenta en Firebase.
    console.log('Registrar:', { nombre, carrera, correo });
    errorRegistro.textContent = '✔ Datos válidos (Firebase se conecta en la Etapa 5).'
})