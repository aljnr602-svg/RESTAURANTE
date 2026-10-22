
const db = new Dexie("RestauranteDB");

db.version(1).stores({
    pedidos: "++id, plato, bebida, extras, total, fecha"
});

const PRECIOS = {
    pizza: 12.00,
    hamburguesa: 7.50,
    pequena: 1.00,
    mediana: 1.50,
    grande: 2.00,
    papas: 2.50,
    helado: 1.80
};

const NOMBRES_PLATOS = {
    pizza: "Pizza Familiar",
    hamburguesa: "Hamburguesa con Queso"
};

const NOMBRES_BEBIDAS = {
    pequena: "Pequeña",
    mediana: "Mediana",
    grande: "Grande"
};

const formulario = document.getElementById("formularioRestaurante");
const areaRecibo = document.getElementById("reciboRespuesta");
const divHistorial = document.getElementById("tablaHistorial");

// Registrar un pedido, mostrar el ticket y guardar la información.
formulario.addEventListener("submit", async function (event) {
    event.preventDefault();

    const plato = document.getElementById("platoPrincipal").value;
    const radioBebida = document.querySelector('input[name="tamanoBebida"]:checked');

    if (!radioBebida) {
        alert("Selecciona el tamaño de la bebida.");
        return;
    }

    const bebidaSeleccionada = radioBebida.value;
    const quierePapas = document.getElementById("extraPapas").checked;
    const quiereHelado = document.getElementById("extraHelado").checked;

    let total = PRECIOS[plato] + PRECIOS[bebidaSeleccionada];
    const listaExtras = [];
    let cuentaDetalle = "<strong>🧾 DETALLE DE TU PEDIDO</strong><br><hr>";
    cuentaDetalle += `• ${NOMBRES_PLATOS[plato]}: $${PRECIOS[plato].toFixed(2)}<br>`;
    cuentaDetalle += `• Bebida ${NOMBRES_BEBIDAS[bebidaSeleccionada]}: $${PRECIOS[bebidaSeleccionada].toFixed(2)}<br>`;

    if (quierePapas) {
        total += PRECIOS.papas;
        listaExtras.push("Papas Fritas");
        cuentaDetalle += `• Papas fritas: $${PRECIOS.papas.toFixed(2)}<br>`;
    }

    if (quiereHelado) {
        total += PRECIOS.helado;
        listaExtras.push("Helado");
        cuentaDetalle += `• Helado de vainilla: $${PRECIOS.helado.toFixed(2)}<br>`;
    }

    cuentaDetalle += `<hr><strong>💰 TOTAL A PAGAR: $${total.toFixed(2)}</strong>`;
    areaRecibo.innerHTML = cuentaDetalle;
    areaRecibo.style.display = "block";

    try {
        await db.pedidos.add({
            plato: NOMBRES_PLATOS[plato],
            bebida: NOMBRES_BEBIDAS[bebidaSeleccionada],
            extras: listaExtras.join(", ") || "Ninguno",
            total: total,
            fecha: new Date().toLocaleString()
        });

        areaRecibo.innerHTML += "<br><span style='color:#196f3d'><strong>✅ Pedido guardado en el historial.</strong></span>";

        // Si el historial está abierto, actualizarlo inmediatamente.
        if (divHistorial.style.display !== "none" && divHistorial.style.display !== "") {
            await actualizarHistorialPantalla();
        }
    } catch (error) {
        console.error("Error al guardar el pedido:", error);
        areaRecibo.innerHTML += "<br><span style='color:#c0392b'><strong>⚠️ No se pudo guardar el pedido. Comprueba que Dexie se haya cargado.</strong></span>";
    }
});

// Leer la base de datos y mostrar los pedidos guardados.
async function actualizarHistorialPantalla() {
    try {
        const todosLosPedidos = await db.pedidos.orderBy("id").reverse().toArray();

        if (todosLosPedidos.length === 0) {
            divHistorial.innerHTML = "<p style='text-align:center;color:#6c757d;'>No hay pedidos registrados todavía.</p>";
            return;
        }

        let gananciasTotales = 0;
        let htmlContenido = "";

        todosLosPedidos.forEach(function (pedido) {
            gananciasTotales += Number(pedido.total) || 0;
            htmlContenido += `
                <div class="item-pedido">
                    <strong>Pedido #${pedido.id}</strong> — 📅 ${escapeHTML(pedido.fecha)}<br>
                    🍽️ Plato: ${escapeHTML(pedido.plato)}<br>
                    🥤 Bebida: ${escapeHTML(pedido.bebida)}<br>
                    🍟 Extras: ${escapeHTML(pedido.extras)}<br>
                    💰 Total: <strong>$${Number(pedido.total).toFixed(2)}</strong>
                </div>`;
        });

        divHistorial.innerHTML =
            `<div class="resumen-caja"><strong>📈 Caja total: $${gananciasTotales.toFixed(2)}</strong><br>Pedidos registrados: ${todosLosPedidos.length}</div>` +
            htmlContenido;
    } catch (error) {
        console.error("Error al cargar el historial:", error);
        divHistorial.innerHTML = "<p style='color:#c0392b;'>No se pudo cargar el historial. Comprueba que Dexie se haya cargado correctamente.</p>";
    }
}

// Evitar interpretar como HTML el texto guardado en la base de datos.
function escapeHTML(valor) {
    return String(valor).replace(/[&<>"']/g, function (caracter) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[caracter];
    });
}

// Botón para mostrar u ocultar el historial.
document.getElementById("btnVerHistorial").addEventListener("click", async function () {
    if (divHistorial.style.display === "none" || divHistorial.style.display === "") {
        await actualizarHistorialPantalla();
        divHistorial.style.display = "block";
        this.textContent = "📋 Ocultar historial";
    } else {
        divHistorial.style.display = "none";
        this.textContent = "📋 Ver historial";
    }
});

// Botón para borrar todos los pedidos guardados.
document.getElementById("btnBorrarHistorial").addEventListener("click", async function () {
    const confirmar = confirm("¿Estás seguro de que deseas eliminar TODOS los pedidos del historial? Esta acción no se puede deshacer.");

    if (!confirmar) {
        return;
    }

    try {
        await db.pedidos.clear();
        await actualizarHistorialPantalla();
        alert("Se eliminaron todos los pedidos del historial.");
    } catch (error) {
        console.error("Error al borrar el historial:", error);
        alert("No se pudo borrar el historial.");
    }
});
