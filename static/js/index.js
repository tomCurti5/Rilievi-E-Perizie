"use strict";

const url = "https://maps.googleapis.com/maps/api";
let mappa;

let commenti = {
  vetCommenti: [],
  index: 0,
};

$(document).ready(function () {
  // creazione dinamica del CDN di accesso alle google maps
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

  // Aggiungilo qui
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
            window.location.href = "login.html"; // Rimuovi lo slash iniziale
        }
    });
  });
});

function documentReady() {
  $("#perizia").hide();
  $("#newUser").hide();
  hideFilter();

  // Recupera le perizie e gli operatori
  let perizieRequest = inviaRichiesta("GET", "/api/perizie");
  let operatoriRequest = inviaRichiesta("GET", "/api/operatori");

  $.when(perizieRequest, operatoriRequest).done(function (perizieResponse, operatoriResponse) {
    const perizie = perizieResponse[0];
    const operatori = operatoriResponse[0];

    popolaMappa(perizie); // Popola la mappa
    popolaTabella(perizie, operatori); // Popola la tabella con i nomi degli operatori
    popolaDropdownOperatori(operatori, perizie); // Popola la tendina degli operatori
  }).fail(errore);

  $("#btnNewUser").on("click", function () {
    $("#home").hide();
    $("#perizia").hide();
    $("#newUser").show();
    $("#lblSuccess").hide();
  });

  // Logout
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

// Funzione per popolare la tendina degli operatori migliorata
function popolaDropdownOperatori(operatori, perizie) {
  const dropdown = $("#operatorDropdown");
  const filterButton = $("#btnFilter");
  dropdown.empty();

  // Conta perizie per operatore
  const periziePerOperatore = {};
  perizie.forEach(perizia => {
    const idOperatore = perizia.codOperatore;
    periziePerOperatore[idOperatore] = (periziePerOperatore[idOperatore] || 0) + 1;
  });

  // Aggiungi l'opzione "Tutti"
  const allOption = $("<a>")
    .addClass("dropdown-item")
    .attr("data-id", "tutti")
    .html(`Tutti <span class="operator-count">${perizie.length}</span>`)
    .css("cursor", "pointer")
    .on("click", function(e) {
      // Aggiungi effetto ripple
      addRippleEffect(e, this);
      
      filterButton.text("Employee Filter");
      popolaMappa(perizie);
      popolaTabella(perizie, operatori);
    });
  dropdown.append(allOption);

  // Aggiungi un'opzione per ogni operatore (escludendo "Admin")
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
        // Aggiungi effetto ripple
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

// Funzione per aggiungere l'effetto ripple
function addRippleEffect(event, element) {
  // Rimuovi eventuali ripple esistenti
  $(element).find(".ripple").remove();
  
  // Crea l'elemento ripple
  const ripple = $("<span class='ripple'></span>");
  const rippleContainer = $(element);
  
  // Posizione del click relativa all'elemento
  const posX = event.pageX - rippleContainer.offset().left;
  const posY = event.pageY - rippleContainer.offset().top;
  
  // Posiziona l'effetto ripple
  ripple.css({
    top: posY + "px",
    left: posX + "px"
  }).appendTo(rippleContainer);
  
  // Rimuovi l'effetto dopo l'animazione
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
    tableBody.empty(); // Svuota la tabella prima di popolarla

    for (const perizia of perizie) {
        const row = $("<tr>");

        // Trova il nome dell'operatore corrispondente al codice
        const operatore = operatori.find(op => op._id.$oid === perizia.codOperatore || op._id === perizia.codOperatore);
        let operatoreNome = operatore ? operatore.username : "N/A";

        // Aggiungi uno spazio tra nome e cognome
        operatoreNome = operatoreNome.replace(/([a-z])([A-Z])/g, "$1 $2");

        // Colonna Operatore
        const operatoreCell = $("<td>").text(operatoreNome);
        row.append(operatoreCell);

        // Colonna Data
        const date = new Date(perizia["data-ora"]);
        const formattedDate = date.toLocaleDateString() + " " + date.toLocaleTimeString();
        const dateCell = $("<td>").text(formattedDate);
        row.append(dateCell);

        // Colonna Descrizione
        const descriptionCell = $("<td>").text(perizia.descrizione || "N/A");
        row.append(descriptionCell);

        // Colonna Coordinate
        const coordinates = `${perizia.coordinate.latitude}, ${perizia.coordinate.longitude}`;
        const coordinatesCell = $("<td>").text(coordinates);
        row.append(coordinatesCell);

        // Colonna Commento
        const commentCell = $("<td>").text(perizia.foto && perizia.foto[0].commento ? perizia.foto[0].commento : "N/A");
        row.append(commentCell);

        // Aggiungi evento onclick per reindirizzare alla pagina dei dettagli
        row.on("click", function () {
            const id = perizia._id.$oid || perizia._id; // Recupera l'ID della perizia
            const url = `dettagli.html?id=${id}`; // Costruisce l'URL con il parametro ID
            window.location.href = url; // Reindirizza alla pagina dei dettagli
        });

        tableBody.append(row);
    }
}
