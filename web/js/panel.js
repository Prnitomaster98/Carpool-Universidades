
//Lo primero que corre app.html y recomendaciones.html

import { protegerPagina, cerrarSesion } from "./sesion.js";

const usuario = await protegerPagina()

document.body.classList.remove("cargando")

document.getElementById("saludo").textContent = `Hola, ${usuario.displayName ?? 'estudiante'}`
document.getElementById("boton-salir").addEventListener('click', cerrarSesion) //Pantalla de carga básicamente, aparte del saludo que revisa que todo esté en orden con la base de datos