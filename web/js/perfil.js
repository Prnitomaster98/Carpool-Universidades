
// Verifica que haya sesión (protegerPagina, igual que panel.js).
//  Dibuja las zonas
// Hace la forma de ingreso de los días y horarios
//  Revisa que exista un usuario ya creado con tus datos y si no existe lo crea
// Ingresa tus datos
// Al presionar guardar los manda a firestore

import { db } from './firebase-config.js' //Importa la base de datos
import { protegerPagina } from './sesion.js'
import {
  doc,         // "dirección" de un documento: usuarios/{uid} 
  getDoc,      // leer un documento
  setDoc,      // crear un documento 
  updateDoc,   // cambiar campos de un documento
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js'
import { DIAS } from './matching.js'


const TOLERANCIA_POR_DEFECTO = 20;

// ---------- Elementos de la página ----------
const formulario = document.getElementById('form-perfil')
const contenedorZonas = document.getElementById('perfil-zonas')
const cuerpoHorario = document.getElementById('perfil-horario')
const selectTolerancia = document.getElementById('perfil-tolerancia') //El select de la tolerancia, 10, 20 y 30
const botonGuardar = document.getElementById('perfil-guardar')
const mensaje = document.getElementById('perfil-mensaje')

let referenciaPerfil = null
let perfilActual = null       // Creo la variable para que no truene si no existe


//Muestra un mensaje de si se enviaron los datos bien
function mostrarMensaje(texto, tipo = '') {
  mensaje.textContent = texto;
  mensaje.className = `mensaje-perfil ${tipo}`
}


//Usa async para esperar a firebase y el archivo geoJson
async function cargarZonas() {
  const respuesta = await fetch('data/zonas.geojson')
  if (!respuesta.ok) throw new Error('No se pudo leer zonas.geojson') //Manda excepción si no se pudo leer
  const geojson = await respuesta.json()
  return geojson.features.map((zona) => ({ //Map para afectar toda la colección
    id: zona.properties.id,
    nombre: zona.properties.nombre,
  }))
}


//Dibuja los checkboxes de las zonas
function dibujarZonas(zonas) {
  contenedorZonas.replaceChildren()
  for (const zona of zonas) {
    const etiqueta = document.createElement('label') //Utiliza fors y va reemplazando con replace children
    etiqueta.className = 'opcion'

    const casilla = document.createElement('input')
    casilla.type = 'checkbox'
    casilla.name = 'zonas'
    casilla.value = zona.id

    etiqueta.append(casilla, ` ${zona.nombre}`)
    contenedorZonas.append(etiqueta)
  }
}


//Ingresa las casillas que sirven para meter horarios con tablas
function dibujarHorario() {
  cuerpoHorario.replaceChildren()
  for (const dia of DIAS) {
    const fila = document.createElement('tr')

    const celdaDia = document.createElement('th')
    celdaDia.scope = 'row'
    celdaDia.textContent = dia.nombre
    fila.append(celdaDia)

    for (const campo of ['entrada', 'salida']) {
      const celda = document.createElement('td')
      const reloj = document.createElement('input')
      reloj.type = 'time'
      reloj.id = `${campo}-${dia.id}` //altero la celda de las horas
      reloj.setAttribute('aria-label', `${campo === 'entrada' ? 'Entrada' : 'Salida'} del ${dia.nombre.toLowerCase()}`) //Uso todos los días y cambio un atributo del css
      celda.append(reloj)
      fila.append(celda)
    }
    cuerpoHorario.append(fila)
  }
}


//Obtiene el archivo  si no existe lo crea
async function obtenerOCrearPerfil(usuario) {
  referenciaPerfil = doc(db, 'usuarios', usuario.uid);
  const documento = await getDoc(referenciaPerfil);

  if (documento.exists()) {
    return documento.data()   // .data crea el archivo por si no existe
  }

  const nuevo = {
    uid: usuario.uid,
    nombre: (usuario.displayName ?? 'Estudiante').slice(0, 60),   // No puede ser muy grande, por eso lo corto en caracteres
    carrera: '',
    esDemo: false,
  }
  await setDoc(referenciaPerfil, nuevo)
  return nuevo
}

function llenarFormulario(perfil) {
  for (const radio of formulario.elements.rol) {
    radio.checked = radio.value === perfil.rol //Revisa si lo colocado es correcto, checked guarda true o false
  }

  // Marca las zonas relevantes según lo seleccionado
  const zonasGuardadas = perfil.zonas ?? [];
  for (const casilla of contenedorZonas.querySelectorAll('input[name="zonas"]')) { //queryselector all cambia algo del css con un evento
    casilla.checked = zonasGuardadas.includes(casilla.value);
  }

  // Si no hay día descarta el orario, para eso sirve ?. un operador que hace que si algo no se encuentra no truene
  for (const dia of DIAS) {
    const horasDelDia = perfil.horario?.[dia.id];
    document.getElementById(`entrada-${dia.id}`).value = horasDelDia?.entrada ?? '' //Rellena entrada y salida, si no hay nada no truena, solo no mete nada
    document.getElementById(`salida-${dia.id}`).value = horasDelDia?.salida ?? '' //Usa solo horas del dia si existe.
  }
  selectTolerancia.value = String(perfil.tolerancia ?? TOLERANCIA_POR_DEFECTO) //Si no hay tolerancia ingresada usa 20
}


// Ve el formulario y guarda todos los datos del objeto que se gurada
function leerFormulario() {
  const radioElegido = formulario.querySelector('input[name="rol"]:checked') //Encuentra un elemento que tenga esto dentro de su CSS

  // Mete las casillas en una lista normal encontrado todas las que estén marcadas. Al clickearlas se marcan en el CSS lo que sirve para obtenerlas
  const zonas = [...contenedorZonas.querySelectorAll('input[name="zonas"]:checked')]
    .map((casilla) => casilla.value) //Solo obtiene el valor de las casillas y las vuelve una lista

  const horario = {}
  for (const dia of DIAS) {
    const entrada = document.getElementById(`entrada-${dia.id}`).value //Horario de entrada por día
    const salida = document.getElementById(`salida-${dia.id}`).value //Horario de salida por día
    // Solo uso el día si tiene un horario por lo menos
    if (entrada || salida) horario[dia.id] = { entrada, salida };
  }

  return {
    rol: radioElegido ? radioElegido.value : null, //Regresa el rol, revisa aue haya escogido uno, si no no regreas nada
    zonas,
    horario,
    tolerancia: Number(selectTolerancia.value),   // del Convierto el texto en número que viene del select
  };
}


// Revisa que los datos estan ingresados, si si hay alguno malo da un error, si no regresa null
function validar(datos) {
  if (!datos.rol) return 'Elige si eres conductor, pasajero o ambos.'
  if (datos.zonas.length === 0) return 'Elige al menos una zona.'

  const dias = Object.keys(datos.horario)   // los días que llenaste
  if (dias.length === 0) return 'Llena el horario de al menos un día.' //Que haya mínimo un día 

  for (const idDia of dias) {
    const { entrada, salida } = datos.horario[idDia] //Obtiene los horarios para hacerles validaciones
    const nombre = DIAS.find((dia) => dia.id === idDia).nombre
    if (!entrada || !salida) return `${nombre}: pon la hora de entrada y la de salida (o deja las dos vacías).`
    if (salida <= entrada) return `${nombre}: la salida tiene que ser después de la entrada.` //Revisa horarios (Salida después que entrada)
  }
  return null
}


// Actualiza el perfil y hace que los demas lo reciban para ver si cambian sus estados.
function anunciarPerfil() {
  document.dispatchEvent(new CustomEvent('perfil-listo', { detail: perfilActual }))
}

async function guardar(evento) {
  evento.preventDefault()   // sin esto, el formulario recarga la página

  const datos = leerFormulario()
  const error = validar(datos)
  if (error) {
    mostrarMensaje(error, 'error')
    return //Llama a los demás datos
  }

  botonGuardar.disabled = true
  mostrarMensaje('Guardando…')
  try {
    // Reemplaza los datos completos
    await updateDoc(referenciaPerfil, datos);
    perfilActual = { ...perfilActual, ...datos }   // Pone encima lo nuevo
    mostrarMensaje('Perfil guardado.', 'exito')
    anunciarPerfil()
  } catch (error) {
    console.error(error)
    if (error.code === 'permission-denied') {
      mostrarMensaje('Firestore rechazó los datos. ¿Ya publicaste las reglas nuevas en la consola de Firebase?', 'error') //Mensajes de errores
    } else {
      mostrarMensaje('No se pudo guardar. Revisa tu conexión e inténtalo otra vez.', 'error')
    }
  } finally {
    // finally corre siempre, haya salido bien o mal
    botonGuardar.disabled = false
  }
}

const usuario = await protegerPagina();   // si no hay sesión, aquí ya redirigió

try { //Es como el main, llama a todas las funciones.
  dibujarZonas(await cargarZonas());
  dibujarHorario();
  perfilActual = await obtenerOCrearPerfil(usuario);
  llenarFormulario(perfilActual);
  formulario.addEventListener('submit', guardar);
  botonGuardar.disabled = false;
  anunciarPerfil();
} catch (error) {
  console.error(error);
  mostrarMensaje('No se pudo cargar tu perfil. Recarga la página.', 'error');
}
