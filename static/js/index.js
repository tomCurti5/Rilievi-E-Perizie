"use strict";

const url = "https://maps.googleapis.com/maps/api";
let mappa;

let commenti = {
  vetCommenti: [],
  index: 0,
};

$(document).ready(function () {
  let request = inviaRichiesta("GET", "/api/MAP_KEY");
  request.fail(errore);
  request.done(function (key) {
    console.log(url + "/js?v=3&key=" + key.key + "&callback=documentReady");
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      `${url}/js?v=3&key=${key.key}&callback=documentReady`;
    document.body.appendChild(script);
  });

  $("#btnLogout").on("click", function () {
    Swal.fire({
        title: 'Sei sicuro di voler uscire?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sì, esci',
        cancelButtonText: 'Annulla'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem("authToken");
            sessionStorage.removeItem("authToken");
            window.location.href = "login.html";
        }
    });
  });

  $("#btnGestioneOperatori").on("click", function(){
    mostraGestioneOperatori();
  });

  $("#newOperatorName, #newOperatorEmail").on("input", validaFormNuovoOperatore);
    
  $("#btnCreaOperatore").prop("disabled", true);
});

function documentReady() {
  $("#perizia").hide();
  $("#newUser").hide();
  hideFilter();

  let perizieRequest = inviaRichiesta("GET", "/api/perizie");
  let operatoriRequest = inviaRichiesta("GET", "/api/operatori");

  $.when(perizieRequest, operatoriRequest).done(function (perizieResponse, operatoriResponse) {
    const perizie = perizieResponse[0];
    const operatori = operatoriResponse[0];

    popolaMappa(perizie);
    popolaTabella(perizie, operatori);
    popolaDropdownOperatori(operatori, perizie);
  }).fail(errore);

  $("#btnNewUser").on("click", function () {
    $("#home").hide();
    $("#perizia").hide();
    $("#newUser").show();
    $("#lblSuccess").hide();
  });

  $("#btnLogout").on("click", function () {
    Swal.fire({
        title: 'Sei sicuro di voler uscire?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sì, esci',
        cancelButtonText: 'Annulla'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem("authToken");
            sessionStorage.removeItem("authToken");
            window.location.href = "/login.html";
        }
    });
  });
  /**** carousel management *****/
  $(".carousel-control-prev").on("click", function () {
    commenti.vetCommenti[commenti.index] = $(
      "#exampleFormControlTextarea2"
    ).val();
    if (commenti.index == 0) commenti.index = commenti.vetCommenti.length - 1;
    else commenti.index--;
    $("#exampleFormControlTextarea2").val(commenti.vetCommenti[commenti.index]);
    console.log(commenti.vetCommenti);
  });

  $(".carousel-control-next").on("click", function () {
    commenti.vetCommenti[commenti.index] = $(
      "#exampleFormControlTextarea2"
    ).val();
    if (commenti.index == commenti.vetCommenti.length - 1) commenti.index = 0;
    else commenti.index++;
    $("#exampleFormControlTextarea2").val(commenti.vetCommenti[commenti.index]);
    console.log(commenti.vetCommenti);
  });

  $("#commentCarousel")
    .children("button")
    .eq(0)
    .on("click", function () {
      let descrizione = $("#exampleFormControlTextarea1").val();

      commenti.vetCommenti[commenti.index] = $(
        "#exampleFormControlTextarea2"
      ).val();

      let foto = [];
      let imgs = $("#carouselExampleControls").find("img");
      for (let i = 0; i < commenti.vetCommenti.length; i++) {
        let record = {
          img: imgs.eq(i).prop("src"),
          commento: commenti.vetCommenti[i++],
        };
        foto.push(record);
      }

      let request = inviaRichiesta("POST", "/api/aggiornaPerizia", {
        descrizione,
        foto: JSON.stringify(foto),
        id: $(this).prop("id"),
      });
      request.fail(errore);
      request.done(function (data) {
        $("#perizia").hide();
        $("#home").show();
      });
    });
}

function popolaDropdownOperatori(operatori, perizie) {
  const dropdown = $("#operatorDropdown");
  const filterButton = $("#btnFilter");
  dropdown.empty();

  const periziePerOperatore = {};
  perizie.forEach(perizia => {
    const idOperatore = perizia.codOperatore;
    periziePerOperatore[idOperatore] = (periziePerOperatore[idOperatore] || 0) + 1;
  });

  const allOption = $("<a>")
    .addClass("dropdown-item")
    .attr("data-id", "tutti")
    .html(`Tutti <span class="operator-count">${perizie.length}</span>`)
    .css("cursor", "pointer")
    .on("click", function(e) {
      addRippleEffect(e, this);
      
      filterButton.text("Filtra per operatore");
      popolaMappa(perizie);
      popolaTabella(perizie, operatori);
    });
  dropdown.append(allOption);

  for (const operatore of operatori) {
    if (operatore.username === "Admin") continue;

    const operatoreId = operatore._id.$oid || operatore._id;
    const operatoreNome = operatore.username.replace(/([a-z])([A-Z])/g, "$1 $2");
    const numPerizie = periziePerOperatore[operatoreId] || 0;
    
    const option = $("<a>")
      .addClass("dropdown-item")
      .attr("data-id", operatoreId)
      .html(`${operatoreNome} <span class="operator-count">${numPerizie}</span>`)
      .css("cursor", "pointer")
      .on("click", function(e) {
        addRippleEffect(e, this);
        
        filterButton.text(operatoreNome);
        const perizieFiltrate = perizie.filter(perizia => 
          perizia.codOperatore === operatoreId);
        
        popolaMappa(perizieFiltrate);
        popolaTabella(perizieFiltrate, operatori);
      });
    dropdown.append(option);
  }
}

function addRippleEffect(event, element) {
  $(element).find(".ripple").remove();
  
  const ripple = $("<span class='ripple'></span>");
  const rippleContainer = $(element);
  
  const posX = event.pageX - rippleContainer.offset().left;
  const posY = event.pageY - rippleContainer.offset().top;
  
  ripple.css({
    top: posY + "px",
    left: posX + "px"
  }).appendTo(rippleContainer);
  
  setTimeout(() => {
    ripple.remove();
  }, 600);
}

function popolaPerizia(perizia) {
  let divperizia = $("#dettagliPerizia");
  let requestOperatore = inviaRichiesta("GET", "/api/operatore", {
    _id: perizia.codOperatore,
  });
  requestOperatore.fail(errore);
  requestOperatore.done(function (operatore) {
    operatore = operatore[0];
    divperizia.children("img").eq(0).attr("src", operatore['"img"']);
    divperizia.children("h3").eq(0).text(operatore.username);

    let date = new Date(perizia["data-ora"]);
    let dataFormattata =
      date.toLocaleDateString() + " " + date.toLocaleTimeString();
    divperizia.children("h4").eq(0).text(dataFormattata);

    divperizia.children("h4").eq(1).text(getIndirizzo(perizia.coordinate));

    divperizia.find("textarea").eq(0).text(perizia.descrizione);

    commenti.vetCommenti = [];
    commenti.index = 0;
    for (const img of perizia.foto) {
      let div = $("<div>");
      div.addClass("carousel-item");
      let imgTag = $("<img>");
      imgTag.addClass("d-block w-100");
      imgTag.prop("src", img.img);
      div.append(imgTag);
      $("#carouselExampleControls").children("div").append(div);
      commenti.vetCommenti.push(img.commento);
    }
    $("#carouselExampleControls")
      .children("div")
      .children("div")
      .eq(0)
      .addClass("active");
    $("#exampleFormControlTextarea2")
      .eq(0)
      .text(commenti.vetCommenti[commenti.index]);
  });

  $("#commentCarousel").children("button").eq(0).prop("id", perizia._id);
}

function popolaOperatori(operatori) {
  console.log(operatori);
  $("#filter").children("ul").eq(0).empty();
  let li = $("<li>");
  li.addClass(
    "list-group-item d-flex justify-content-between align-items-center"
  );
  li.css("cursor", "pointer");
  li.text("All");
  li.on("click", function () {
    let request = inviaRichiesta("GET", "/api/perizie");
    request.fail(errore);
    request.done(function (perizie) {
      console.log(perizie);
      popolaMappa(perizie);
    });
    hideFilter();
  });
  $("#filter").children("ul").eq(0).append(li);

  let length = operatori.length;
  if (operatori.length > 15) {
    length = 15;
  }
  for (let index = 0; index < length; index++) {
    const operatore = operatori[index];
    let li = $("<li>");
    li.addClass(
      "list-group-item d-flex justify-content-between align-items-center"
    );
    li.css("cursor", "pointer");
    li.text(operatore.nome);
    li.on("click", function () {
      console.log(operatore._id);
      let request = inviaRichiesta("GET", "/api/perizieUtente", {
        codOperatore: operatore._id,
      });
      request.fail(errore);
      request.done(function (perizie) {
        console.log(perizie);
        popolaMappa(perizie);
      });
      hideFilter();
    });
    let span = $("<span>");
    span.addClass("badge badge-success badge-pill");
    span.text(operatore.nPerizie);
    li.append(span);
    $("#filter").children("ul").eq(0).append(li);
  }
}

function popolaTabella(perizie, operatori) {
    const tableBody = $("#perizieTableBody");
    tableBody.empty();

    for (const perizia of perizie) {
        const row = $("<tr>");

        const operatore = operatori.find(op => op._id.$oid === perizia.codOperatore || op._id === perizia.codOperatore);
        let operatoreNome = operatore ? operatore.username : "N/A";

        operatoreNome = operatoreNome.replace(/([a-z])([A-Z])/g, "$1 $2");

        const operatoreCell = $("<td>").text(operatoreNome);
        row.append(operatoreCell);

        const date = new Date(perizia["data-ora"]);
        const formattedDate = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        const dateCell = $("<td>").text(formattedDate);
        row.append(dateCell);

        const descriptionCell = $("<td>").text(perizia.descrizione || "N/A");
        row.append(descriptionCell);

        const coordinates = `${perizia.coordinate.latitude}, ${perizia.coordinate.longitude}`;
        const coordinatesCell = $("<td>").text(coordinates);
        row.append(coordinatesCell);

        const commentCell = $("<td>").text(perizia.foto && perizia.foto[0].commento ? perizia.foto[0].commento : "N/A");
        row.append(commentCell);

        row.on("click", function () {
            const id = perizia._id.$oid || perizia._id;
            const url = `dettagli.html?id=${id}`;
            window.location.href = url;
        });

        tableBody.append(row);
    }
}

function caricaListaOperatori() {
    $("#operatoriTableBody").html('<tr><td colspan="4" class="text-center">Caricamento...</td></tr>');
    
    inviaRichiesta("GET", "/api/operatori")
        .then(function(data) {
            const tableBody = $("#operatoriTableBody");
            tableBody.empty();
            
            data.forEach(function(operatore) {
                if (operatore.email === "admin@azienda.com" || operatore.username === "Admin") {
                    return;
                }
                
                const row = $("<tr>");
                row.append($("<td>").text(operatore.username));
                row.append($("<td>").text(operatore.email || "N/A"));
                row.append($("<td>").text(operatore.nPerizie || 0));
                
                const actionsCell = $("<td>");
                
                const btnModifica = $("<button>")
                    .addClass("btn btn-sm btn-primary mr-2")
                    .html('<i class="fas fa-edit"></i>')
                    .click(function() {
                        mostraModalModifica(operatore);
                    });
                
                const btnElimina = $("<button>")
                    .addClass("btn btn-sm btn-danger")
                    .html('<i class="fas fa-trash"></i>')
                    .click(function() {
                        confermaEliminazione(operatore);
                    });
                
                actionsCell.append(btnModifica, btnElimina);
                row.append(actionsCell);
                
                tableBody.append(row);
            });
            
            if (tableBody.children().length === 0) {
                tableBody.html('<tr><td colspan="4" class="text-center">Nessun operatore trovato</td></tr>');
            }
        })
        .catch(function(err) {
            console.error("Errore caricamento operatori:", err);
            $("#operatoriTableBody").html(
                '<tr><td colspan="4" class="text-center text-danger">Errore nel caricamento degli operatori</td></tr>'
            );
        });
}

function mostraModalModifica(operatore) {
    $("#operatorModalId").val(operatore._id.$oid || operatore._id);
    $("#operatorModalName").val(operatore.username);
    $("#operatorModalEmail").val(operatore.email || "");
    $("#operatorModalPassword").val("");
    $("#operatorModalResetPassword").prop("checked", false);
    $("#operatorModal").modal("show");
}

function salvaModificheOperatore() {
    const id = $("#operatorModalId").val();
    let username = $("#operatorModalName").val().trim();
    const email = $("#operatorModalEmail").val().trim();
    const password = $("#operatorModalPassword").val().trim();
    const resetPassword = $("#operatorModalResetPassword").is(":checked");
    
    if (!username || !email) {
        Swal.fire({
            icon: 'error',
            title: 'Dati mancanti',
            text: 'Nome e email sono obbligatori'
        });
        return;
    }
    
    username = formatUsername(username);
    
    const data = {
        username: username,
        email: email,
    };
    
    if (password) {
        data.password = password;
    }
    
    if (resetPassword) {
        data.resetPassword = true;
    }
    
    Swal.fire({
        title: 'Salvataggio in corso...',
        text: 'Attendere prego',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            
            inviaRichiesta("PUT", `/api/operatori/${id}`, data)
                .then(function(response) {
                    $("#operatorModal").modal("hide");
                    Swal.fire({
                        icon: 'success',
                        title: 'Operatore aggiornato',
                        text: 'Le modifiche sono state salvate con successo'
                    });
                    caricaListaOperatori();
                })
                .catch(function(err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Errore',
                        text: err.responseText || 'Si è verificato un errore durante l\'aggiornamento dell\'operatore'
                    });
                });
        }
    });
}

function confermaEliminazione(operatore) {
    Swal.fire({
        title: 'Conferma eliminazione',
        text: `Sei sicuro di voler eliminare l'operatore ${operatore.username}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sì, elimina',
        cancelButtonText: 'Annulla'
    }).then((result) => {
        if (result.isConfirmed) {
            eliminaOperatore(operatore._id.$oid || operatore._id);
        }
    });
}

function eliminaOperatore(id) {
    Swal.fire({
        title: 'Eliminazione in corso...',
        text: 'Attendere prego',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            
            inviaRichiesta("DELETE", `/api/operatori/${id}`)
                .then(function(response) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Operatore eliminato',
                        text: 'L\'operatore è stato eliminato con successo'
                    });
                    caricaListaOperatori();
                })
                .catch(function(err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Errore',
                        text: err.responseText || 'Si è verificato un errore durante l\'eliminazione dell\'operatore'
                    });
                });
        }
    });
}

function mostraGestioneOperatori() {
    $("#home").hide();
    $("#perizia").hide();
    $("#operatoriSection").show();
    
    $("#btnFilter").parent().addClass("disabled");
    $("#btnFilter").attr("aria-disabled", "true");
    $("#btnFilter").css("pointer-events", "none");
    $("#btnFilter").css("opacity", "0.5");
    
    caricaListaOperatori();
}

function tornaPaginaPrincipale() {
    $("#operatoriSection").hide();
    $("#home").show();
    
    $("#btnFilter").parent().removeClass("disabled");
    $("#btnFilter").removeAttr("aria-disabled");
    $("#btnFilter").css("pointer-events", "auto");
    $("#btnFilter").css("opacity", "1");
}

function mostraModalNuovoOperatore() {
    $("#formNuovoOperatore")[0].reset();
    $("#newOperatorModal").modal("show");
}

function validaFormNuovoOperatore() {
    const name = $("#newOperatorName").val().trim();
    const email = $("#newOperatorEmail").val().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (name && email && emailRegex.test(email)) {
        $("#btnCreaOperatore").prop("disabled", false);
    } else {
        $("#btnCreaOperatore").prop("disabled", true);
    }
}

function creaNuovoOperatore() {
    let name = $("#newOperatorName").val().trim();
    const email = $("#newOperatorEmail").val().trim();
    
    if (!name || !email) {
        Swal.fire({
            icon: 'error',
            title: 'Dati mancanti',
            text: 'Nome e email sono obbligatori'
        });
        return;
    }
    
    name = formatUsername(name);
    
    Swal.fire({
        title: 'Creazione in corso...',
        text: 'Attendere prego',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
            
            const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken");
            
            fetch("/api/nuovoOperatore", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, email })
            })
            .then(response => {
                if (response.ok || response.status === 201) {
                    $("#newOperatorModal").modal("hide");
                    Swal.fire({
                        icon: 'success',
                        title: 'Operatore creato',
                        text: 'Operatore creato con successo. La password è stata inviata via email.'
                    });
                    caricaListaOperatori();
                } else {
                    return response.text().then(text => { throw new Error(text) });
                }
            })
            .catch(error => {
                Swal.fire({
                    icon: 'error',
                    title: 'Errore',
                    text: error.message || 'Si è verificato un errore durante la creazione dell\'operatore'
                });
            });
        }
    });
}

function formatUsername(name) {
    return name.split(' ')
        .filter(word => word.trim() !== '')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}
