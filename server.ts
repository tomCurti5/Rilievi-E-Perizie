"use strict";

// import
import http from "http";
import https from "https";
import fs from "fs";
import express from "express"; // @types/express
import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import { Double, MongoClient, ObjectId } from "mongodb";
import cors from "cors"; // @types/cors
import fileUpload, { UploadedFile } from "express-fileupload";
import cloudinary, { UploadApiResponse } from "cloudinary";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

// config
const app = express();
const HTTP_PORT = process.env.PORT || 3000;
dotenv.config({ path: ".env" });
/* ********************** Mongo config ********************** */
const dbName = "RilieviPerizie";
const connectionString = "mongodb+srv://admin:admin@cluster0.nls05.mongodb.net/";

cloudinary.v2.config(JSON.parse(process.env.cloudinaryConfig as string));
const whiteList = [
  "http://localhost:3000",
  "https://localhost:3001",
  "https://192.168.1.70:3001",
  "https://10.88.205.125:3001",
  "https://cordovaapp",
];
const corsOptions = {
  origin: function (origin: any, callback: any) {
    return callback(null, true);
  },
  credentials: true,
};
const HTTPS_PORT = 3001;
const privateKey = fs.readFileSync("keys/privateKey.pem", "utf8");
console.log("Private Key:", privateKey ? "Caricata correttamente" : "Errore nel caricamento");
const certificate = fs.readFileSync("keys/certificate.crt", "utf8");
const credentials = { key: privateKey, cert: certificate };
const DURATA_TOKEN = 3600;

// ***************************** Avvio ****************************************
const httpServer = http.createServer(app);
httpServer.listen(HTTP_PORT, function () {
  init();
  console.log("Server HTTP in ascolto sulla porta " + HTTP_PORT);
});
let httpsServer = https.createServer(credentials, app);
httpsServer.listen(HTTPS_PORT, function () {
  console.log(
    "Server in ascolto sulle porte HTTP:" + HTTP_PORT + ", HTTPS:" + HTTPS_PORT
  );
});
let paginaErrore = "";
function init() {
  fs.readFile("./static/error.html", function (err, data) {
    if (!err) paginaErrore = data.toString();
    else paginaErrore = "<h1>Risorsa non trovata</h1>";
  });
}

/* *********************** (Sezione 2) Middleware ********************* */
// 1. Request log
app.use("/", function (req, res, next) {
  console.log("** " + req.method + " ** : " + req.originalUrl);
  next();
});

// Static
app.use("/", express.static("./static"));

// 3 - lettura dei parametri post
app.use("/", express.json({ limit: "20mb" }));
app.use("/", express.urlencoded({ extended: true, limit: "20mb" }));

// 4 - binary upload
app.use(
  "/",
  fileUpload({
    limits: { fileSize: 20 * 1024 * 1024 }, // 20*1024*1024 // 20 M
  })
);

// 5 - log dei parametri
app.use("/", function (req, res, next) {
  if (Object.keys(req.query).length > 0)
    console.log("        Parametri GET: ", req.query);
  if (Object.keys(req.body).length != 0)
    console.log("        Parametri BODY: ", req.body);
  next();
});

// 6. cors
app.use("/", cors(corsOptions));

// 7. gestione login
app.post(
  "/api/login",
  function (req: Request, res: Response, next: NextFunction) {
    let connection = new MongoClient(connectionString as string);
    connection
      .connect()
      .then((client: MongoClient) => {
        const collection = client.db(dbName).collection("operatori");
        let regex = new RegExp(`^${req.body.email}$`, "i");
        collection
          .findOne({ email: regex })
          .then((dbUser: any) => {
            if (!dbUser) {
              res.status(401); // user o password non validi
              res.send("User not found");
            } else {
              // confronto la password in chiaro
              if (req.body.password !== dbUser.password) {
                // password errata
                res.status(401);
                res.send("Wrong password");
              } else {
                let token = createToken(dbUser);
                res.setHeader("Authorization", `Bearer ${token}`);
                // Per permettere le richieste extra domain
                res.setHeader(
                  "access-control-expose-headers",
                  "Authorization"
                );
                res.send({ ris: "ok" });
              }
            }
          })
          .catch((err: Error) => {
            res.status(500);
            res.send("Query error " + err.message);
            console.log(err.stack);
          })
          .finally(() => {
            client.close();
          });
      })
      .catch((err: Error) => {
        res.status(503);
        res.send("Database service unavailable");
      });
  }
);

function createToken(user: any) {
  const now = Math.floor(Date.now() / 1000); // Data attuale in secondi
  const payload = {
    iat: now, // Tempo di emissione
    exp: now + DURATA_TOKEN, // Tempo di scadenza
    _id: user._id.toString(), // Converti ObjectId in stringa
    email: user.email,
  };
  const token = jwt.sign(payload, privateKey);
  console.log("Creato nuovo token:", token);
  return token;
}

// 7 Bis gestione login google
app.post(
  "/api/googleLogin",
  function (req: Request, res: Response, next: NextFunction) {
    let googleToken = req.body.token;
    const googlePublicKey = "YOUR_GOOGLE_PUBLIC_KEY"; // Sostituisci con la chiave pubblica di Google
    jwt.verify(googleToken, googlePublicKey, (err: any, googleData: any) => {
      if (err) {
        res.status(401).send("Token Google non valido");
      } else {
        console.log("Dati Google decodificati:", googleData);
        let connection = new MongoClient(connectionString as string);
        connection
          .connect()
          .then((client: MongoClient) => {
            const collection = client.db(dbName).collection("operatori");
            let regex = new RegExp(`^${googleData.email}$`, "i");
            collection
              .findOne({ email: regex })
              .then((dbUser: any) => {
                if (!dbUser) {
                  res.status(401); // user o password non validi
                  res.send("User not found");
                } else {
                  let token = createToken(dbUser);
                  res.setHeader("Authorization", `Bearer ${token}`);
                  // Per permettere le richieste extra domain
                  res.setHeader(
                    "access-control-expose-headers",
                    "Authorization"
                  );
                  res.send({ ris: "ok" });
                }
              })
              .catch((err: Error) => {
                res.status(500);
                res.send("Query error " + err.message);
                console.log(err.stack);
              })
              .finally(() => {
                client.close();
              });
          })
          .catch((err: Error) => {
            res.status(503);
            res.send("Database service unavailable");
          });
      }
    });
  }
);

// 8. gestione Logout

// 9. Controllo del Token
app.use("/api", function (req: any, res: Response, next: NextFunction) {
  console.log("Headers ricevuti:", req.headers);
  console.log("Token ricevuto:", req.headers["authorization"]);
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Token mancante o malformattato");
    res.status(403).send("Token mancante o malformattato");
  } else {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, privateKey, (err: any, payload: any) => {
      if (err) {
        console.log("Errore nella verifica del token:", err.message);
        res.status(403).send("Token scaduto o corrotto");
      } else {
        console.log("Token verificato con successo:", payload);
        const newToken = createToken(payload); // Rigenera il token
        res.setHeader("Authorization", `Bearer ${newToken}`);
        res.setHeader("access-control-expose-headers", "Authorization");
        req["payload"] = payload; // Salva il payload decodificato
        next();
      }
    });
  }
});

// 10. Apertura della connessione
app.use("/api/", function (req: any, res: any, next: NextFunction) {
  let connection = new MongoClient(connectionString as string);
  connection
    .connect()
    .then((client: any) => {
      req["connessione"] = client;
      next();
    })
    .catch((err: any) => {
      let msg = "Errore di connessione al db";
      res.status(503).send(msg);
    });
});

/* ********************* (Sezione 3) USER ROUTES  ************************** */

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

app.get("/api/MAP_KEY", (req: any, res: Response, next: NextFunction) => {
  let mapKey = process.env.MAP_KEY
  res.send({ key: mapKey });
});

app.get("/api/perizie", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(dbName).collection("perizie");
  collection.find({}).toArray((err: Error, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.get("/api/perizie/:id", (req: any, res: Response, next: NextFunction) => {
  const id = req.params.id;
  const collection = req["connessione"].db(dbName).collection("perizie");

  collection.findOne({ _id: new ObjectId(id) }, (err: Error, data: any) => {
    if (err) {
      res.status(500).send("Errore esecuzione query");
    } else if (!data) {
      res.status(404).send("Perizia non trovata");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.get("/api/perizieUtente", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(dbName).collection("perizie");
  collection
    .find({ codOperatore: req.query.codOperatore })
    .toArray((err: Error, data: any) => {
      if (err) {
        res.status(500);
        res.send("Errore esecuzione query");
      } else {
        res.send(data);
      }
      req["connessione"].close();
    });
});

app.get("/api/operatore", (req: any, res: Response, next: NextFunction) => {
  let _id = new ObjectId(req.query._id);
  let collection = req["connessione"].db(dbName).collection("operatori");
  collection.find({ _id: _id }).toArray((err: Error, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.post(
  "/api/aggiornaPerizia",
  (req: any, res: Response, next: NextFunction) => {
    let descrizione = req.body.descrizione;
    let foto = req.body.foto;
    let _id = new ObjectId(req.body.id);

    let collection = req["connessione"].db(dbName).collection("perizie");

    collection.updateOne(
      { _id: _id },
      { $set: { descrizione: descrizione, foto: JSON.parse(foto) } },
      (err: Error, data: any) => {
        if (err) {
          res.status(500);
          res.send("Errore esecuzione query");
        } else {
          res.send({ ris: "ok" });
        }
        req["connessione"].close();
      }
    );
  }
);

app.get("/api/operatori", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(dbName).collection("operatori");
  collection.find({}).toArray((err: Error, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.post("/api/employ", (req: any, res: Response, next: NextFunction) => {
  let nome = req.body.name;
  let mail = req.body.mail;
  bcrypt.genSalt(10, function (err, salt) {
    bcrypt.hash("password", salt, function (err, hash) {
      let record = {
        password: hash,
        nome: nome,
        mail: mail,
        nPerizie: "0",
        '"img"':
          "https://res.cloudinary.com/dfrqbcbln/image/upload/v1672932919/assicurazioni/img_avatar_e9p0bx.png",
      };

      let collection = req["connessione"].db(dbName).collection("operatori");
      collection.insertOne(record, (err: Error, data: any) => {
        if (err) {
          res.status(500);
          res.send("Errore esecuzione query");
        } else {
          res.send({ ris: "ok" });
        }
        req["connessione"].close();
      });
    });
  });
});

app.get("/api/operatore1", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(dbName).collection("operatori");
  console.log(req["payload"]._id);
  let _id = new ObjectId(req["payload"]._id);
  collection.find({ _id }).toArray((err: Error, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send(data);
    }
    req["connessione"].close();
  });
});

app.post("/api/updatePwd", (req: any, res: Response, next: NextFunction) => {
  let collection = req["connessione"].db(dbName).collection("operatori");
  console.log(req["payload"]._id);
  let _id = new ObjectId(req["payload"]._id);
  bcrypt.genSalt(10, function (err, salt) {
    bcrypt.hash(req.body.pwd, salt, function (err, hash) {
      collection.updateOne(
        { _id },
        { $set: { password: hash } },
        (err: Error, data: any) => {
          if (err) {
            res.status(500);
            res.send("Errore esecuzione query");
          } else {
            res.send(data);
          }
          req["connessione"].close();
        }
      );
    });
  });
});

app.post(
  "/api/updateOperatore",
  (req: any, res: Response, next: NextFunction) => {
    cloudinary.v2.uploader
      .upload(req.body.img, { folder: "assicurazioni" })
      .then((result: UploadApiResponse) => {
        let collection = req["connessione"].db(dbName).collection("operatori");
        console.log(req["payload"]._id);
        let _id = new ObjectId(req["payload"]._id);
        bcrypt.genSalt(10, function (err, salt) {
          bcrypt.hash(req.body.pwd, salt, function (err, hash) {
            collection.updateOne(
              { _id },
              {
                $set: {
                  nome: req.body.name.toString(),
                  email: req.body.mail,
                  '"img"': result.secure_url,
                },
              },
              (err: Error, data: any) => {
                if (err) {
                  res.status(500);
                  res.send("Errore esecuzione query");
                } else {
                  res.send(data);
                }
                req["connessione"].close();
              }
            );
          });
        });
      })
      .catch((err: any) => {
        res.status(500);
        res.send("Error upload file to Cloudinary. Error: " + err.message);
      });
  }
);

app.post("/api/newPhoto", (req: any, res: Response, next: NextFunction) => {
  cloudinary.v2.uploader
    .upload(req.body.img, { folder: "assicurazioni" })
    .then((result: UploadApiResponse) => {
      res.send({ path: result.secure_url });
    })
    .catch((err: any) => {
      res.status(500);
      res.send("Error upload file to Cloudinary. Error: " + err.message);
    });
});

app.post("/api/newReport", (req: any, res: Response, next: NextFunction) => {
  let record = req.body.record;
  record.codOperatore = req["payload"]._id;

  let collection = req["connessione"].db(dbName).collection("perizie");

  collection.insertOne(record, (err: Error, data: any) => {
    if (err) {
      res.status(500);
      res.send("Errore esecuzione query");
    } else {
      res.send({ ris: "ok" });
    }
    req["connessione"].close();
  });
});

app.post("/api/nuovoOperatore", async (req: any, res: Response, next: NextFunction) => {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      res.status(400).send("Nome ed email sono obbligatori.");
      return;
    }

    const collection = req["connessione"].db(dbName).collection("operatori");

    // Controlla se esiste già un operatore con lo stesso nome
    const operatoreEsistente = await collection.findOne({ username: name });
    if (operatoreEsistente) {
      res.status(409).send("Esiste già un operatore con questo nome.");
      return;
    }

    // Genera una password casuale
    const password = Math.random().toString(36).slice(-8);
    const nuovoOperatore = {
      username: name,
      email: email,
      password: password,
      nPerizie: 0,
      img: "https://www.w3schools.com/howto/img_avatar.png",
    };

    // Inserisci il nuovo operatore nel database
    await collection.insertOne(nuovoOperatore);

    // Configura Nodemailer per inviare l'email
    const transporter = nodemailer.createTransport({
      service: "gmail", // Puoi usare altri servizi come Outlook, Yahoo, ecc.
      auth: {
        user: process.env.EMAIL_USER, // Email del mittente (configurata in .env)
        pass: process.env.EMAIL_PASS, // Password dell'email del mittente
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER, // Mittente
      to: email, // Destinatario
      subject: "Benvenuto! Ecco la tua password iniziale",
      text: `Ciao ${name},\n\nLa tua password iniziale è: ${password}\nTi consigliamo di cambiarla al primo accesso.\n\nGrazie!`,
    };

    // Invia l'email
    await transporter.sendMail(mailOptions);

    res.status(201).send("Operatore creato con successo. La password è stata inviata via email.");
  } catch (err) {
    console.error("Errore nella creazione dell'operatore:", err);
    res.status(500).send("Errore nella creazione dell'operatore.");
  } finally {
    req["connessione"].close();
  }
});

/* ********************** (Sezione 4) DEFAULT ROUTE  ************************* */
// Default route
app.use("/", function (req: any, res: any, next: NextFunction) {
  res.status(404);
  if (req.originalUrl.startsWith("/api/")) {
    res.send("Risorsa non trovata");
    req["connessione"].close();
  } else res.send(paginaErrore);
});

// Gestione degli errori
app.use("/", (err: any, req: any, res: any, next: any) => {
  if (req["connessione"]) req["connessione"].close();
  res.status(500);
  res.send("ERRR: " + err.message);
  console.log("SERVER ERROR " + err.stack);
});
