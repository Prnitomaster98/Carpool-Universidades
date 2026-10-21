// Agrupa tarjetas (viajes o solicitudes) en cajas que se abren y se cierran.
// Así no se acumulan: cada estado tiene su caja con un contador, y si hay
// muchas solo se ven las primeras con un botón "Ver X más".
//
// Uso:
//   dibujarGrupos(contenedor, grupos, dibujar, textoVacio)
//   grupos = [{ id: 'pendiente', titulo: 'Pendientes', elementos: [...], abierto: true }]
//   dibujar = función que recibe UN elemento y devuelve su <li>
//   textoVacio = lo que se muestra si todos los grupos están vacíos

const CUANTOS_SE_VEN = 3;

// Recordamos qué cajas abriste o cerraste, para que no se reinicien
// cada vez que la lista se vuelve a dibujar (por ejemplo, al llegar una solicitud).
const abiertos = new Map();
const expandidos = new Set();

function crear(etiqueta, clase, texto) {
  const elemento = document.createElement(etiqueta);
  if (clase) elemento.className = clase;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

export function dibujarGrupos(contenedor, grupos, dibujar, textoVacio) {
  contenedor.replaceChildren();

  const conAlgo = grupos.filter((grupo) => grupo.elementos.length > 0);
  if (conAlgo.length === 0) {
    contenedor.append(crear("p", "coincidencia-detalle", textoVacio));
    return;
  }

  for (const grupo of conAlgo) {
    // La clave lleva el id del contenedor: "pendiente" de recibidas
    // y "pendiente" de enviadas son cajas distintas.
    const clave = `${contenedor.id}-${grupo.id}`;

    // <details> es una caja que el navegador ya sabe abrir y cerrar sola
    const caja = crear("details", `grupo grupo-${grupo.id}`);
    caja.open = abiertos.get(clave) ?? grupo.abierto;
    caja.addEventListener("toggle", () => abiertos.set(clave, caja.open));

    const resumen = crear("summary", "grupo-resumen");
    resumen.append(
      crear("span", "grupo-titulo", grupo.titulo),
      crear("span", "grupo-contador", String(grupo.elementos.length)),
    );

    const lista = crear("ul", "lista-coincidencias");
    const botonMas = crear("button", "boton-enlace grupo-mas");
    botonMas.type = "button";

    function llenar() {
      const verTodos = expandidos.has(clave);
      const visibles = verTodos
        ? grupo.elementos
        : grupo.elementos.slice(0, CUANTOS_SE_VEN);
      lista.replaceChildren(...visibles.map(dibujar));

      const escondidos = grupo.elementos.length - CUANTOS_SE_VEN;
      botonMas.hidden = escondidos <= 0;
      botonMas.textContent = verTodos ? "Ver menos" : `Ver ${escondidos} más`;
    }

    botonMas.addEventListener("click", () => {
      if (expandidos.has(clave)) expandidos.delete(clave);
      else expandidos.add(clave);
      llenar();
    });

    llenar();
    caja.append(resumen, lista, botonMas);
    contenedor.append(caja);
  }
}
