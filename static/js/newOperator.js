$(document).ready(function () {
    // Gestisci la creazione di un nuovo operatore
    $("#formNewOperator").on("submit", function (e) {
        e.preventDefault();

        const name = $("#operatorName").val();
        const email = $("#operatorEmail").val();

        const request = inviaRichiesta("POST", "/api/nuovoOperatore", { name, email });
        request.done(function () {
            $("#successMessage").show(); // Mostra il messaggio di successo
            $("#formNewOperator")[0].reset(); // Resetta il modulo
        });
        request.fail(function (err) {
            if (err.status === 409) {
                alert("Errore: Esiste già un operatore con questo nome.");
            } else if(err.status === 201) {
                $("#successMessage").show(); // Mostra il messaggio di successo
                $("#formNewOperator")[0].reset(); // Resetta il modulo
            } else{
                alert("Attenzione: " + err.responseText)
            }
        });
    });
});

// Funzione per inviare richieste AJAX
function inviaRichiesta(metodo, url, dati = {}) {
    const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken"); // Recupera il token JWT
    
    return $.ajax({
        type: metodo,
        url: url,
        data: JSON.stringify(dati),
        contentType: "application/json",
        dataType: "json",
        headers: {
            Authorization: `Bearer ${token}`, // Aggiungi il token JWT nell'intestazione
        },
    });
}