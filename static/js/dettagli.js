$(document).ready(function () {
    // Aggiungi evento click al pulsante per tornare alla User Area
    $("#btnUserArea").click(function () {
        window.location.href = "userarea.html"; // Modifica il percorso se necessario
    });

    // Recupera l'ID della perizia dai parametri dell'URL
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
        alert("ID perizia non trovato!");
        return;
    }

    // Effettua una richiesta per ottenere i dettagli della perizia
    const periziaRequest = inviaRichiesta("GET", `/api/perizie/${id}`);
    const operatoriRequest = inviaRichiesta("GET", `/api/operatori`);

    // Gestisci errori per entrambe le richieste
    periziaRequest.fail((err) => {
        console.error("Errore nel recupero dei dettagli della perizia:", err);
        alert("Errore nel caricamento dei dettagli della perizia.");
    });
    operatoriRequest.fail((err) => {
        console.error("Errore nel recupero degli operatori:", err);
        alert("Errore nel caricamento degli operatori.");
    });

    // Gestisci il completamento delle richieste
    $.when(periziaRequest, operatoriRequest).done((periziaResponse, operatoriResponse) => {
        const perizia = periziaResponse[0]; // Risultato della prima richiesta
        const operatori = operatoriResponse[0]; // Risultato della seconda richiesta

        // Trova l'operatore corrispondente al codice
        const operatore = operatori.find(op => op._id.$oid === perizia.codOperatore || op._id === perizia.codOperatore);
        let nomeOperatore = operatore ? operatore.username : "N/A";

        // Aggiungi uno spazio tra nome e cognome
        nomeOperatore = nomeOperatore.replace(/([a-z])([A-Z])/g, "$1 $2");

        // Aggiorna i dettagli nella pagina utilizzando jQuery
        const carouselInner = $("#carouselFoto .carousel-inner");
        carouselInner.empty();
        if (perizia.foto && perizia.foto.length > 0) {
            perizia.foto.forEach((f, idx) => {
                carouselInner.append(`
                    <div class="carousel-item${idx === 0 ? " active" : ""}">
                        <img src="${f.img}" class="d-block w-100" alt="Foto perizia" style="max-width:300px; margin:auto; border-radius:10px;">
                        <div class="carousel-caption d-none d-md-block">
                            <p>${f.commento || ""}</p>
                        </div>
                    </div>
                `);
            });
        } else {
            carouselInner.append(`
                <div class="carousel-item active">
                    <img src="https://via.placeholder.com/300x200" class="d-block w-100" alt="Nessuna foto">
                </div>
            `);
        }

        // ...dopo aver aggiunto tutte le .carousel-item...
        $("#carouselFoto").carousel(0);

        $("#nomeOperatore").html(`<span class="bold">Operatore:</span> ${nomeOperatore}`);
        $("#dataOra").html(`<span class="bold">Data e Ora:</span> ${new Date(perizia["data-ora"]).toLocaleString()}`);

        // Ottieni l'indirizzo dalle coordinate
        if (perizia.coordinate) {
            getIndirizzo(perizia.coordinate.latitude, perizia.coordinate.longitude)
                .then((indirizzo) => {
                    $("#indirizzo").html(`<span class="bold">Indirizzo:</span> ${indirizzo}`);
                })
                .catch((err) => {
                    console.error("Errore nel recupero dell'indirizzo:", err);
                    $("#indirizzo").html(`<span class="bold">Indirizzo:</span> Non disponibile`);
                });
        } else {
            $("#indirizzo").html(`<span class="bold">Indirizzo:</span> Non disponibile`);
        }

        $("#descrizione").html(`<span class="bold">Descrizione:</span> ${perizia.descrizione || "N/A"}`);
    });
});

// Funzione per ottenere l'indirizzo dalle coordinate
function getIndirizzo(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    return new Promise((resolve, reject) => {
        $.get(url)
            .done((data) => {
                if (data && data.display_name) {
                    resolve(data.display_name);
                } else {
                    reject("Indirizzo non trovato");
                }
            })
            .fail((err) => {
                reject(err);
            });
    });
}