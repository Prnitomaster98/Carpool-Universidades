import { db } from './firebase-config.js'
import { doc, getDoc} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js' //Importo la base de datos y funciones de firebase
const numerosYaBuscados = new Map() //Creo una colección que guarda los números ya buscados, para ahorrar tiempo
export async function leerTelefono(uid){ //Esta función revisa si ya existe un número en la base de datos, si no hay ninguno retorna null
    if (!uid) return null
    if (numerosYaBuscados.has(uid)) return numerosYaBuscados.get(uid) //Estos ifs revisan que no exista un número ya
    let telefono = null
    try {
        const documento = await getDoc(doc(db, 'contactos', uid)) //Obtiene la referencia al documento en la database
        if (documento.exists()) telefono = documento.data().telefono ?? null //Telefono guarda el valor si existe, si no guarda null
    } catch (problema){
        if (problema.code !== 'permission-denied') console.warn('No se pudo leer el número', problema)

    }
    numerosYaBuscados.set(uid,telefono) //Guarda el número que ya se buscó en la colección
    return telefono //Retorna el teléfono
}

export function botonContacto({uid, nombre, texto, telefono}){ //Crea el botón con todas sus funciones
    const boton = document.createElement('button')
    boton.type = 'button'
    boton.className = "boton boton-secundario"
    let numero = telefono || null //Crea el botón y guarda la variable número, en caso no haber guarda null

    function actualizar(){ //Revisa si existe un número, si no existe desactiva el botón y avisa que el usuario no ha guardado su número
        boton.disabled = !numero
        boton.textContent = numero ? `Escribir a ${nombre} por WhatsApp`: `${nombre} no compartió su WhatsApp`
    }

    if (numero){
        actualizar() //Si hay número revisa
    } else{
        boton.textContent = 'Buscando número...'
        boton.disabled = true // Si no va a revisar a la dataBase, si lo encuentra vuelva a llamar a actualizar, si no regresa que no se encontró
        leerTelefono(uid).then((encontrado) => {
            numero = encontrado
            actualizar()
        })
    }

    boton.addEventListener('click', ()=>{
        if (!numero) return //Cuando se presiona el botón te manda a un link de whatsapp con el número.
        window.open(`https://wa.me/502${numero}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    })
    return boton
}
