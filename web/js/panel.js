
//Lo primero que corre app.html

import { protegerPagina, cerrarSesion } from "./sesion.js";

const usuario = await protegerPagina()

document.body.classList.remove("cargando")

document.getElementById("saludo").textContent = `Hola, ${usuario.displayName ?? 'estudiante'}`
document.getElementById("boton-salir").addEventListener('click', cerrarSesion)