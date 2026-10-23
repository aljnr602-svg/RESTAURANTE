// IndexedDB conserva los pedidos aunque se cierre la página.
// Se mantiene el nombre de la base del proyecto original.
const solicitud = indexedDB.open('RestauranteDB');
const base = new Promise((resolve, reject) => {
    solicitud.onupgradeneeded = () => {
        const db = solicitud.result;
        if (!db.objectStoreNames.contains('pedidos')) {
            const tabla = db.createObjectStore('pedidos', {keyPath: 'id', autoIncrement: true});
            ['plato', 'bebida', 'extras', 'total', 'fecha'].forEach(campo => tabla.createIndex(campo, campo));
        }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
    solicitud.onblocked = () => mensaje('Cierra otras pestañas del restaurante y vuelve a intentar.', true);
});
const precios = {pizza:12, hamburguesa:7.5, pequena:1, mediana:1.5, grande:2, papas:2.5, helado:1.8};
const platos = {pizza:'Pizza Familiar', hamburguesa:'Hamburguesa con Queso'};
const bebidas = {pequena:'Pequeña', mediana:'Mediana', grande:'Grande'};
const form = document.getElementById('formularioRestaurante');
const historial = document.getElementById('tablaHistorial');
const guardar = document.getElementById('btnGuardar');
let pedidos = [];
const dinero = valor => '$' + Number(valor).toFixed(2);
const escapar = valor => String(valor).replace(/[&<>"']/g, letra => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[letra]));
function mensaje(texto, error = false) {
    const estado = document.getElementById('estado');
    estado.textContent = texto;
    estado.classList.toggle('error', error);
}
// Resolver al completar la transacción garantiza que el cambio se guardó.
async function operar(modo, accion) {
    const db = await base;
    return new Promise((resolve, reject) => {
        const transaccion = db.transaction('pedidos', modo);
        const peticion = accion(transaccion.objectStore('pedidos'));
        transaccion.oncomplete = () => resolve(peticion.result);
        transaccion.onerror = () => reject(transaccion.error);
        transaccion.onabort = () => reject(transaccion.error);
    });
}
function leerSeleccion() {
    const plato = document.getElementById('platoPrincipal').value;
    const bebida = form.querySelector('input[name="tamanoBebida"]:checked').value;
    const extras = [];
    let centavos = Math.round(precios[plato] * 100) + Math.round(precios[bebida] * 100);
    if (document.getElementById('extraPapas').checked) { extras.push('Papas Fritas'); centavos += 250; }
    if (document.getElementById('extraHelado').checked) { extras.push('Helado'); centavos += 180; }
    return {plato:platos[plato], bebida:bebidas[bebida], extras:extras.join(', ') || 'Ninguno', total:centavos / 100, fecha:new Date().toLocaleString('es-GT')};
}
function actualizarTotal() { document.getElementById('totalPrevio').textContent = dinero(leerSeleccion().total); }
form.addEventListener('change', actualizarTotal);
form.addEventListener('reset', () => { setTimeout(actualizarTotal, 0); mensaje('Selección lista para un nuevo pedido.'); });
function contenidoTicket(pedido) {
    return `<h3>Pedido #${escapar(pedido.id)}</h3><span class="fecha">${escapar(pedido.fecha)}</span><div class="detalle"><p><strong>${escapar(pedido.plato)}</strong></p><p>Bebida: ${escapar(pedido.bebida)}</p><p>Extras: ${escapar(pedido.extras)}</p></div><div class="pie-ticket"><strong>${dinero(pedido.total)}</strong><button type="button" data-imprimir="${Number(pedido.id)}" aria-label="Imprimir ticket ${Number(pedido.id)}">Imprimir ↗</button></div>`;
}
async function actualizarHistorial() {
    pedidos = await operar('readonly', tabla => tabla.getAll());
    pedidos.sort((a,b) => b.id - a.id);
    document.getElementById('cantidad').textContent = pedidos.length;
    document.getElementById('caja').textContent = dinero(pedidos.reduce((suma,pedido) => suma + Number(pedido.total), 0));
    historial.innerHTML = pedidos.length ? pedidos.map(pedido => `<article class="ticket">${contenidoTicket(pedido)}</article>`).join('') : '<div class="vacio"><span aria-hidden="true">🧾</span>Aún no hay tickets.<br>Guarda tu primer pedido para verlo aquí.</div>';
    document.getElementById('btnBorrarHistorial').disabled = pedidos.length === 0;
}
form.addEventListener('submit', async event => {
    event.preventDefault();
    guardar.disabled = true;
    try {
        const id = await operar('readwrite', tabla => tabla.add(leerSeleccion()));
        await actualizarHistorial();
        historial.hidden = false;
        document.getElementById('btnVerHistorial').textContent = 'Ocultar historial';
        document.getElementById('btnVerHistorial').setAttribute('aria-expanded', 'true');
        mensaje(`Pedido #${id} guardado. Tu ticket ya aparece en el historial.`);
    } catch (error) { console.error(error); mensaje('No se pudo guardar el pedido. Revisa que el navegador permita el almacenamiento local.', true); }
    finally { guardar.disabled = false; }
});
document.getElementById('btnVerHistorial').addEventListener('click', async function () {
    historial.hidden = !historial.hidden;
    this.textContent = historial.hidden ? 'Ver historial' : 'Ocultar historial';
    this.setAttribute('aria-expanded', String(!historial.hidden));
    if (!historial.hidden) {
        try { await actualizarHistorial(); } catch (error) { mensaje('No se pudo consultar el historial.', true); }
    }
});
const confirmacion = document.getElementById('confirmacion');
document.getElementById('btnBorrarHistorial').addEventListener('click', () => { confirmacion.hidden = false; document.getElementById('cancelarBorrado').focus(); });
document.getElementById('cancelarBorrado').addEventListener('click', () => { confirmacion.hidden = true; document.getElementById('btnBorrarHistorial').focus(); });
document.getElementById('confirmarBorrado').addEventListener('click', async function () {
    this.disabled = true;
    guardar.disabled = true;
    try {
        await operar('readwrite', tabla => tabla.clear());
        await actualizarHistorial();
        confirmacion.hidden = true;
        mensaje('El historial se ha limpiado. Puedes registrar nuevos pedidos.');
        document.getElementById('zonaImpresion').replaceChildren();
    } catch (error) { mensaje('No se pudo limpiar el historial.', true); }
    finally { this.disabled = false; guardar.disabled = false; }
});
// Imprime solo el ticket elegido, sin ventanas nuevas ni el formulario.
historial.addEventListener('click', event => {
    const boton = event.target.closest('[data-imprimir]');
    if (!boton) return;
    const pedido = pedidos.find(p => p.id === Number(boton.dataset.imprimir));
    if (!pedido) return;
    document.getElementById('zonaImpresion').innerHTML = '<h2>Restaurante</h2><article class="ticket">' + contenidoTicket(pedido) + '</article><p>¡Gracias por tu compra!</p>';
    window.print();
});
actualizarHistorial().catch(error => { console.error(error); mensaje('No se pudo abrir el historial. Habilita el almacenamiento del navegador.', true); });
