const body = {
  idProvincia: "28",
  tipoOperacion: "COMPRA",
  idCategoriaTipoVivienda: "1",
  paginacion: { numeroPagina: 0, tamanoPagina: 5 },
};
const res = await fetch("https://www.solvia.es/api/inmuebles/v2/buscarInmuebles", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
    Origin: "https://www.solvia.es",
    Referer: "https://www.solvia.es/es/comprar/viviendas",
  },
  body: JSON.stringify(body),
});
const j = await res.json();
console.log(JSON.stringify(j.inmuebles?.[0], null, 2).slice(0, 1500));
