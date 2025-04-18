"use strict";

$(document).ready(function () {
  let _username = $("#usr");
  let _password = $("#pwd");
  let _lblErrore = $("#lblErrore");

  _lblErrore.hide();

  $("#btnLogin").on("click", controllaLogin);

  // il submit deve partire anche senza click
  // con il solo tasto INVIO
  $(document).on("keydown", function (event) {
    if (event.keyCode == 13) controllaLogin();
  });

  function controllaLogin() {
    _username.removeClass("is-invalid");
    _username.prev().removeClass("icona-rossa");
    _password.removeClass("is-invalid");
    _password.prev().removeClass("icona-rossa");

    _lblErrore.hide();

    if (_username.val() == "") {
      _username.addClass("is-invalid");
      _username.prev().addClass("icona-rossa");
    } else if (_password.val() == "") {
      _password.addClass("is-invalid");
      _password.prev().addClass("icona-rossa");
    } else {
      let request = inviaRichiesta("POST", "/api/login", {
        email: _username.val(),
        password: _password.val(),
      });
      request.fail(function (jqXHR, test_status, str_error) {
        if (jqXHR.status == 401) {
          _lblErrore.text("Credenziali non valide").show();
        } else if (jqXHR.status == 403) {
          _lblErrore.text("Solo l'amministratore può accedere a questa area.").show();
        } else errore(jqXHR, test_status, str_error);
        // Pulisci eventuali token
        localStorage.removeItem("token");
        sessionStorage.removeItem("token");
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      });
      request.done(function (data, test_status, jqXHR) {
        const token = jqXHR.getResponseHeader("Authorization").split(" ")[1];
        localStorage.setItem("authToken", token); // Salva il token in localStorage

        Swal.fire({
          icon: 'success',
          title: 'Login effettuato!',
          text: 'Benvenuto!',
          showConfirmButton: false,
          timer: 1500
        }).then(() => {
            window.location.href = "userArea.html";
        });
      });
    }
  }

  _lblErrore.children("button").on("click", function () {
    _lblErrore.hide();
  });

  //google login
  // $("#btnLoginGoogle").on("click", function () {
  //   google.accounts.id.initialize({
  //     client_id:
  //       "193434866513-h3mgiuvjpv0s3u1711q545sjahdp7t4r.apps.googleusercontent.com",
  //     callback: function (response) {
  //       if (response.credential != "") {
  //         //console.log(response.credential);
  //         $("#google-signin-button").hide();
  //         let request = inviaRichiesta("POST", "/api/googleLogin", {
  //           token: response.credential,
  //         });
  //         request.fail(function (jqXHR, test_status, str_error) {
  //           if (jqXHR.status == 401) {
  //             alert(
  //               "Non sei autorizzato ad accedere, contatta l'amministratore"
  //             );
  //           } else errore(jqXHR, test_status, str_error);
  //         });
  //         request.done(function (data, test_status, jqXHR) {
  //           console.log(jqXHR.getResponseHeader("Authorization")); //prendiamo il token
  //           window.location.href = "index.html";
  //         });
  //       }
  //     },
  //   });

  //   google.accounts.id.renderButton(
  //     document.getElementById("google-signin-button"),
  //     {
  //       theme: "outline",
  //       size: "large",
  //       type: "standard",
  //       text: "continue_with",
  //       shape: "rectangular",
  //       logo_alignment: "center",
  //     }
  //   );

  //   google.accounts.id.prompt();
  // });

  //global google

  // Esempio: se usi localStorage/sessionStorage
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
});
