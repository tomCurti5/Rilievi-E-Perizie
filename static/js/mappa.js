"use strict";

function popolaMappa(perizie) {
  // Coordinate della sede centrale a Genola
  const sedeCentrale = {
    latitude: 44.5811, // Latitudine di Genola
    longitude: 7.6886, // Longitudine di Genola
  };

  // Inizializza la mappa
  const map = new maplibregl.Map({
    container: "map", // ID del contenitore HTML
    style: "https://api.maptiler.com/maps/streets-v2/style.json?key=7syb7b697dQCycssRTZU", // Stile di MapTiler
    center: [7.6886, 44.5811], // Coordinate iniziali [longitudine, latitudine]
    zoom: 6, // Livello di zoom iniziale
  });

  // Aggiungi controlli di navigazione
  map.addControl(new maplibregl.NavigationControl());

  // Aggiungi marker per la sede centrale
  const sedeMarker = new maplibregl.Marker({
    color: "darkblue", // Colore blu scuro per il marker della sede centrale
  })
    .setLngLat([sedeCentrale.longitude, sedeCentrale.latitude]) // Coordinate della sede centrale
    .setPopup(new maplibregl.Popup().setText("Ufficio - Sede centrale")) // Popup con descrizione
    .addTo(map);

  // Mostra popup "Ufficio" al click sul marker della sede centrale
  const sedeElement = sedeMarker.getElement();
  sedeElement.style.cursor = "pointer"; // <-- aggiungi questa riga
  sedeElement.addEventListener("click", () => {
    new maplibregl.Popup()
      .setLngLat([sedeCentrale.longitude, sedeCentrale.latitude])
      .addTo(map);
  });

  // Aggiungi marker per ogni perizia
  for (const perizia of perizie) {
    const marker = new maplibregl.Marker()
        .setLngLat([perizia.coordinate.longitude, perizia.coordinate.latitude]) // Coordinate del marker
        .addTo(map);

    // Cambia il cursore in "pointer" quando il cursore passa sopra il marker
    const markerElement = marker.getElement();
    markerElement.style.cursor = "pointer";


    // Aggiungi evento click sul marker
    markerElement.addEventListener("click", () => {
        const id = perizia._id.$oid || perizia._id; // Recupera l'ID della perizia
        console.log("ID perizia:", id); // Log per debug
        const url = `../dettagli.html?id=${id}`; // Aggiorna il percorso in base alla posizione di dettagli.html
        console.log("URL generato:", url); // Log per debug
        window.location.href = url; // Reindirizza alla pagina dei dettagli
    });
  }
}

function disegnaPercorso(perizia, map) {
  // Coordinate di partenza (sede centrale)
  const start = [7.6886, 44.5811]; // Coordinate della sede centrale (Genola)
  const end = [perizia.coordinate.longitude, perizia.coordinate.latitude]; // Coordinate della perizia

  // Rimuovi eventuali percorsi esistenti
  if (map.getSource("route")) {
    map.removeLayer("route");
    map.removeSource("route");
  }

  // Crea il percorso come GeoJSON
  const route = {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [start, end],
    },
  };

  // Aggiungi il percorso alla mappa
  if (map.isStyleLoaded()) {
    aggiungiPercorsoAllaMappa(map, route);
  } else {
    map.on("load", () => {
      aggiungiPercorsoAllaMappa(map, route);
    });
  }

  // Mostra informazioni sul tempo di percorrenza (simulato)
  const distanzaStimata = calcolaDistanza(start, end); // Calcola la distanza
  const tempoStimato = Math.round((distanzaStimata / 50) * 60); // Simula un tempo di percorrenza (50 km/h)
  $("#tempoPercorrenza").text(`Tempo stimato: ${tempoStimato} minuti`);
}

function aggiungiPercorsoAllaMappa(map, route) {
  map.addSource("route", {
    type: "geojson",
    data: route,
  });

  map.addLayer({
    id: "route",
    type: "line",
    source: "route",
    layout: {
      "line-join": "round",
      "line-cap": "round",
    },
    paint: {
      "line-color": "#44F", // Colore del percorso
      "line-width": 6, // Spessore della linea
    },
  });
}

function getIndirizzo(coordinate) {
  // MapLibre non supporta direttamente il geocoding, usa un servizio esterno come Nominatim
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinate.latitude}&lon=${coordinate.longitude}`;
  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      console.log("Indirizzo:", data.display_name);
      return data.display_name;
    })
    .catch((err) => {
      console.error("Errore nel recupero dell'indirizzo:", err);
    });
}

function calcolaDistanza(coord1, coord2) {
  const R = 6371; // Raggio della Terra in km
  const lat1 = coord1[1] * (Math.PI / 180);
  const lat2 = coord2[1] * (Math.PI / 180);
  const deltaLat = (coord2[1] - coord1[1]) * (Math.PI / 180);
  const deltaLon = (coord2[0] - coord1[0]) * (Math.PI / 180);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distanza in km
}





