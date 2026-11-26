const bodies = [
  { pagina: 1, tamanoPagina: 24, idProvincia: "28", idCategoria: "1", tipoTransaccion: "Compra" },
  {
    pagina: 1,
    tamanoPagina: 24,
    provincia: "28",
    poblacion: "28079",
    idCategoriaTipoVivienda: "1",
    tipoTransaccion: "Compra",
  },
  {
    pagina: 1,
    tamanoPagina: 24,
    filtros: { idProvincia: "28", idCategoria: "1" },
  },
];
for (const body of bodies) {
  const res = await fetch("https://www.solvia.es/api/inmuebles/v2/buscarInmuebles", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://www.solvia.es",
      Referer: "https://www.solvia.es/es/comprar/viviendas/madrid/madrid",
    },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  const first = j.inmuebles?.[0];
  console.log(
    JSON.stringify({
      body,
      status: res.status,
      n: j.inmuebles?.length,
      prov: first?.provincia?.nombre,
      pob: first?.poblacion?.nombre,
      cat: first?.categoriaTipoVivienda?.nombre,
    })
  );
}
