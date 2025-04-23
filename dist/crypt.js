"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// import
const bcryptjs_1 = __importDefault(require("bcryptjs")); // + @types
const mongodb_1 = require("mongodb");
const dotenv_1 = __importDefault(require("dotenv"));
// config
dotenv_1.default.config({ path: ".env" });
const DBNAME = "5b";
const CONNECTION_STRING = process.env.connectionString;
let connection = new mongodb_1.MongoClient(CONNECTION_STRING);
connection.connect().then((client) => {
    const COLLECTION = client.db(DBNAME).collection('mails');
    COLLECTION.find().project({ "password": 1 }).toArray(function (err, vet) {
        if (err) {
            console.log("Errore esecuzione query" + err.message);
            client.close();
        }
        else {
            for (let item of vet) {
                let oid = new mongodb_1.ObjectId(item["_id"]);
                // le stringhe bcrypt inizano con $2[ayb]$ e sono lunghe 60
                let regex = new RegExp("^\\$2[ayb]\\$.{56}$");
                // se la password corrente non è in formato bcrypt
                if (!regex.test(item["password"])) {
                    console.log("aggiornamento in corso ... ", item);
                    let newPass = bcryptjs_1.default.hashSync(item["password"], 10);
                    COLLECTION.updateOne({ "_id": oid }, { "$set": { "password": newPass } }, function (err, data) {
                        aggiornaCnt(vet.length, client);
                        if (err)
                            console.log("errore aggiornamento record", item["_id"], err.message);
                    });
                }
                else
                    aggiornaCnt(vet.length, client);
            }
            // client.close();  NOK !!
        }
    });
})
    .catch((err) => {
    console.log("Errore di connessione al database");
});
let cnt = 0;
function aggiornaCnt(length, client) {
    cnt++;
    if (cnt == length) {
        console.log("Aggiornamento completato correttamente");
        client.close();
    }
}
