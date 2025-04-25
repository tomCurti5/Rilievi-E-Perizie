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

// Add this type definition at the top of your file
interface Foto {
  url: string;
  commento: string;
  timestamp: Date;
}

// Aggiungi questo helper all'inizio del tuo file, prima delle route
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// config
const app = express();
const HTTP_PORT = process.env.PORT || 3000;
dotenv.config({ path: ".env" });
/* ********************** Mongo config ********************** */
const dbName = "RilieviPerizie";
const connectionString = "mongodb+srv://admin:admin@cluster0.nls05.mongodb.net/";

cloudinary.v2.config(JSON.parse(process.env.CLOUDINARYCONFIG as string));
const whiteList = [
  "https://rilievi-e-perizie-mpo0.onrender.com/",
  "http://localhost:3000",
  "https://localhost:3001",
  "http://localhost:8100",         // Ionic dev server
  "capacitor://localhost",         // App Capacitor
  "ionic://localhost",             // App Ionic
  "http://localhost",              // Generici
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
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;
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
            } else if (dbUser.email !== "admin@azienda.com") {
              // Solo l'admin può accedere
              res.status(403).send("Solo l'amministratore può accedere a questa area.");
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

// API per login operatori (app mobile)
app.post(
  "/api/operatorLogin",
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
              // Verifica se l'email potrebbe essere nello username invece che nel campo email
              return collection.findOne({ username: regex });
            }
            return dbUser;
          })
          .then((dbUser: any) => {
            if (!dbUser) {
              res.status(401); 
              res.send("Operatore non trovato");
            } else {
              // Verifica della password (supporta sia password in chiaro che hash)
              const passwordMatch = dbUser.password === req.body.password || 
                (bcrypt.compareSync(req.body.password, dbUser.password));
              
              if (!passwordMatch) {
                res.status(401);
                res.send("Password errata");
              } else {
                // Crea token con TTL esteso per l'app mobile
                const now = Math.floor(Date.now() / 1000);
                const payload = {
                  iat: now,
                  exp: now + (DURATA_TOKEN * 24 * 7), // Token valido per 7 giorni
                  _id: dbUser._id.toString(),
                  email: dbUser.email || dbUser.username, // Supporta entrambi i campi
                  nome: dbUser.nome || dbUser.username,
                  role: "operator"
                };
                
                const token = jwt.sign(payload, privateKey);
                
                // Prepara dati utente per l'app
                const userData = {
                  id: dbUser._id,
                  nome: dbUser.nome || dbUser.username,
                  email: dbUser.email || dbUser.username,
                  img: dbUser.img || dbUser['"img"'] || "https://www.w3schools.com/howto/img_avatar.png"
                };
                
                res.setHeader("Authorization", `Bearer ${token}`);
                res.setHeader("access-control-expose-headers", "Authorization");
                res.send({ 
                  ris: "ok",
                  token: token, // Includi token anche nel body per client mobile
                  userData: userData
                });
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

app.post("/api/nuovoOperatore", asyncHandler(async (req: any, res: Response, next: NextFunction) => {
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
}));

// Endpoint per l'upload di una nuova perizia completa da app mobile
app.post("/api/nuovaPerizia", asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  try {
    const { descrizione, coordinate, foto, codOperatore } = req.body;
    
    // Validazione dei dati obbligatori
    if (!descrizione || !coordinate || !coordinate.latitude || !coordinate.longitude || !codOperatore) {
      return res.status(400).send("Dati perizia incompleti. Richiesti: descrizione, coordinate e codOperatore");
    }

    // Crea oggetto perizia
    const nuovaPerizia = {
      descrizione: descrizione,
      coordinate: {
        latitude: parseFloat(coordinate.latitude),
        longitude: parseFloat(coordinate.longitude)
      },
      timestamp: new Date(),
      codOperatore: codOperatore,
      foto: [] as Foto[] // Type assertion for the empty array
    };

    // Gestione foto (se presenti)
    if (foto && Array.isArray(foto) && foto.length > 0) {
      nuovaPerizia.foto = foto.map((f: any) => {
        return {
          url: f.url,
          commento: f.commento,
          timestamp: new Date(f.timestamp || Date.now())
        };
      });
    }

    // Salva perizia nel database
    const collection = req["connessione"].db(dbName).collection("perizie");
    const result = await collection.insertOne(nuovaPerizia);
    
    // Incrementa contatore perizie dell'operatore
    const operatoriCollection = req["connessione"].db(dbName).collection("operatori");
    await operatoriCollection.updateOne(
      { _id: new ObjectId(codOperatore) },
      { $inc: { nPerizie: 1 } }
    );

    // Risposta di successo
    res.status(201).send({
      success: true,
      message: "Perizia salvata con successo",
      periziaId: result.insertedId,
      numFoto: nuovaPerizia.foto.length
    });
  } 
  catch (error) {
    console.error("Errore durante il salvataggio della perizia:", error);
    res.status(500).send("Errore durante il salvataggio della perizia");
  }
  finally {
    req["connessione"].close();
  }
}));

// Endpoint per l'upload di una singola foto da aggiungere a una perizia esistente
app.post("/api/perizie/:id/foto", asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  try {
    const periziaId = req.params.id;
    const { url, commento } = req.body;
    
    if (!url || !commento) {
      return res.status(400).send("URL e commento sono obbligatori");
    }
    
    // Crea oggetto foto
    const nuovaFoto = {
      url: url,
      commento: commento,
      timestamp: new Date()
    };
    
    // Aggiunge la foto alla perizia
    const collection = req["connessione"].db(dbName).collection("perizie");
    await collection.updateOne(
      { _id: new ObjectId(periziaId) },
      { $push: { foto: nuovaFoto } }
    );
    
    res.status(201).send({
      success: true,
      message: "Foto aggiunta con successo"
    });
  } 
  catch (error) {
    console.error("Errore durante l'aggiunta della foto:", error);
    res.status(500).send("Errore durante l'aggiunta della foto");
  }
  finally {
    req["connessione"].close();
  }
}));

// Helper per upload diretto su Cloudinary dall'app mobile
app.post("/api/uploadImage", asyncHandler(async (req: any, res: Response, next: NextFunction) => {
  try {
    if (!req.files || !req.files.image) {
      return res.status(400).send("Nessuna immagine caricata");
    }
    
    const imageFile = req.files.image as UploadedFile;
    
    // Carica immagine su Cloudinary
    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.v2.uploader.upload_stream(
        {
          folder: "perizie",
          resource_type: "image",
          transformation: [
            { width: 1200, height: 1200, crop: "limit" } // Limita dimensioni
          ]
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result as UploadApiResponse);
        }
      ).end(imageFile.data);
    });
    
    res.send({
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    });
  } 
  catch (error) {
    console.error("Errore durante l'upload dell'immagine:", error);
    res.status(500).send("Errore durante l'upload dell'immagine");
  }
}));

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
