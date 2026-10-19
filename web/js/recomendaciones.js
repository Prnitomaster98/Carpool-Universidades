
/* =============================================================
   recomendaciones.js — lógica de la página Recomendaciones
   GUÍA DE NOMBRES
   filtroRuta: selector para mostrar una ruta o todas.
   mensajePuntos: párrafo que informa de errores o carga.
   listaRutas: contenedor donde se muestran las rutas y sus puntos.
   listaZonas: las cinco rutas leídas desde zonas.geojson.
   listaPuntos: puntos de encuentro leídos desde el archivo JSON.
   rutaElegida: identificador de la ruta seleccionada.
   zona: ruta que estamos dibujando.
   puntosRuta: puntos que pertenecen a una ruta.
   punto: datos de un punto de encuentro.
   ============================================================= */

const filtroRuta = document.getElementById("filtro-ruta")
const mensajePuntos = document.getElementById("mensaje-puntos")
const listaRutas = document.getElementById("lista-rutas")

let listaZonas = []
let listaPuntos = []

// Funcion para no repetir el codigo
function crearElemento(etiqueta, clase = "", texto = "") {
  const elemento = document.createElement(etiqueta)
  if (clase) elemento.className = clase
  if (texto) elemento.textContent = texto
  return elemento
}

function crearTarjetaPunto(punto) {
  const tarjeta = crearElemento("article", "tarjeta-punto")
  tarjeta.appendChild(crearElemento("h4", "nombre-punto", punto.nombre || "Punto sin nombre"))

  const etiquetas = crearElemento("div", "etiquetas-punto")
  // Revisa la informacion y determina que recomendacion dar
  const nivel = punto.nivel
  if (nivel === "recomendado") {
    etiquetas.appendChild(crearElemento("span", "etiqueta-nivel etiqueta-recomendada", "Recomendado"))
  } else if (nivel === "precaucion") {
    etiquetas.appendChild(crearElemento("span", "etiqueta-nivel etiqueta-precaucion", "Usar con precaución"))
  } else {
    etiquetas.appendChild(crearElemento("span", "etiqueta-nivel etiqueta-pendiente", "Pendiente de evaluar"))
  }
  if (punto.esDemo === true) {
    etiquetas.appendChild(crearElemento("span", "etiqueta-demo", "Dato de prueba"))
  }
  tarjeta.appendChild(etiquetas)

  tarjeta.appendChild(crearElemento("p", "nota-seguridad", punto.notaSeguridad || "No hay una nota de seguridad disponible."))
  if (punto.fechaObservacion) {
    tarjeta.appendChild(crearElemento("p", "fecha-observacion", `Observado el ${punto.fechaObservacion}`))
  }

  // Se verifican las coordenadas del mapa para ver si son validas
  if (Number.isFinite(Number(punto.lat)) && Number.isFinite(Number(punto.lng)) &&
      punto.lat !== null && punto.lng !== null && punto.lat !== undefined && punto.lng !== undefined) {
    const enlace = crearElemento("a", "enlace-maps", "Ver en Google Maps")
    enlace.href = `https://www.google.com/maps?q=${encodeURIComponent(punto.lat)},${encodeURIComponent(punto.lng)}`
    enlace.target = "_blank"
    enlace.rel = "noopener"
    tarjeta.appendChild(enlace)
  }
  return tarjeta
}

function mostrarRutas() {
  listaRutas.replaceChildren()
  const rutaElegida = filtroRuta.value
  const zonasVisibles = listaZonas.filter((zona) => rutaElegida === "todas" || zona.id === rutaElegida)

  for (const zona of zonasVisibles) {
    const seccionRuta = crearElemento("section", "bloque-ruta")
    const cabecera = crearElemento("div", "cabecera-ruta")
    const barraColor = crearElemento("span", "barra-color-ruta")
    // Color del proyecto
    if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(zona.color || "")) {
      barraColor.style.backgroundColor = zona.color
    }
    cabecera.appendChild(barraColor)
    cabecera.appendChild(crearElemento("h3", "nombre-ruta", zona.nombre))
    seccionRuta.appendChild(cabecera)

    const puntosRuta = listaPuntos
      .filter((punto) => punto.zonaId === zona.id)
      .sort((primero, segundo) => {
        const prioridad = { recomendado: 0, precaucion: 1 }
        return (prioridad[primero.nivel] ?? 2) - (prioridad[segundo.nivel] ?? 2)
      })
    if (puntosRuta.length === 0) {
      seccionRuta.appendChild(crearElemento("p", "texto-vacio", "Aún no hay puntos registrados para esta ruta."))
    } else {
      const tarjetas = crearElemento("div", "cuadricula-puntos")
      for (const punto of puntosRuta) tarjetas.appendChild(crearTarjetaPunto(punto))
      seccionRuta.appendChild(tarjetas)
    }
    listaRutas.appendChild(seccionRuta)
  }
  mensajePuntos.textContent = zonasVisibles.length === 0 ? "No se encontraron rutas disponibles." : ""
}

async function cargarRecomendaciones() {
  try {
    // Leer archivos
    const [respuestaZonas, respuestaPuntos] = await Promise.all([
      fetch("data/zonas.geojson"),
      fetch("data/puntos-encuentro.json")
    ])
    if (!respuestaZonas.ok || !respuestaPuntos.ok) {
      throw new Error("No se pudieron descargar los archivos de rutas y puntos.")
    }
    const datosZonas = await respuestaZonas.json()
    const datosPuntos = await respuestaPuntos.json()
    if (!Array.isArray(datosZonas.features) || !Array.isArray(datosPuntos)) {
      throw new Error("El formato de los archivos no es válido.")
    }
    listaZonas = datosZonas.features.map((feature) => feature.properties)
    listaPuntos = datosPuntos

    for (const zona of listaZonas) {
      const opcion = crearElemento("option", "", zona.nombre)
      opcion.value = zona.id
      filtroRuta.appendChild(opcion)
    }
    mostrarRutas()
  } catch (error) {
    console.error("No se pudieron cargar las recomendaciones:", error)
    mensajePuntos.textContent = "No fue posible cargar los puntos de encuentro. Revisa la conexión e intenta recargar la página."
    mensajePuntos.classList.add("error")
  }
}

filtroRuta.addEventListener("change", mostrarRutas)
cargarRecomendaciones()
