const express = require("express");
const fs = require("fs");
const path = require("path");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useSingleFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");

const app = express();
const PORT = 3000;
app.use(express.json());

let sessionFilePath = path.join(__dirname, "session.json");
const { state, saveState } = useSingleFileAuthState(sessionFilePath);

app.post("/api/login", async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: "Phone number is required" });

  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger: pino({ level: "silent" }) });

  sock.ev.on("connection.update", async ({ connection }) => {
    if (connection === "open") {
      const zipPath = path.join(__dirname, "session.zip");
      const archiver = require("archiver");
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", () => {
        setTimeout(() => {
          try {
            fs.unlinkSync(zipPath);
            fs.unlinkSync(sessionFilePath);
          } catch {}
        }, 5 * 60 * 1000);
      });

      archive.pipe(output);
      archive.file(sessionFilePath, { name: "session.json" });
      archive.finalize();
    }
  });

  sock.ev.on("creds.update", saveState);
  res.json({ status: "Attempting login. Please approve on your phone." });
});

app.get("/session", (req, res) => {
  const zipPath = path.join(__dirname, "session.zip");
  if (fs.existsSync(zipPath)) {
    res.download(zipPath);
  } else {
    res.status(404).send("Session not ready");
  }
});

app.listen(PORT, () => console.log("Phone login server running"));
