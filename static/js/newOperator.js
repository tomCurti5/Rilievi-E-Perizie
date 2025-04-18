$(document).ready(function () {
    function checkCampi() {
        const name = $("#operatorName").val().trim();
        const email = $("#operatorEmail").val().trim();
        if (name && email) {
            $("#btnCreaOperatore").prop("disabled", false);
        } else {
            $("#btnCreaOperatore").prop("disabled", true);
        }
    }

    $("#operatorName, #operatorEmail").on("input", checkCampi);

    // Gestisci la creazione di un nuovo operatore
    $("#formNewOperator").on("submit", function (e) {
        e.preventDefault();

        const name = $("#operatorName").val();
        const email = $("#operatorEmail").val();

        const request = inviaRichiesta("POST", "/api/nuovoOperatore", { name, email });
        request.done(function () {
            Swal.fire({
                icon: 'success',
                title: 'Operatore creato!',
                text: 'Il nuovo operatore è stato aggiunto con successo.',
                timer: 2000,
                showConfirmButton: false
            });
            $("#formNewOperator")[0].reset();
            checkCampi();
        });
        request.fail(function (err) {
            if (err.status === 409) {
                Swal.fire({
                    icon: 'error',
                    title: 'Errore',
                    text: 'Esiste già un operatore con questo nome.'
                });
            } else if (err.status === 201) {
                Swal.fire({
                    icon: 'success',
                    title: 'Operatore creato!',
                    text: 'Il nuovo operatore è stato aggiunto con successo.',
                    timer: 2000,
                    showConfirmButton: false
                });
                $("#formNewOperator")[0].reset();
                checkCampi();
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Attenzione',
                    text: err.responseText
                });
            }
        });
    });

    $("#btnCreaOperatore").prop("disabled", true);
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