const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const qrcode = require("qrcode");

const app = express();
const PORT = 3000;

let sessionFilePath = path.join(__dirname, "session.json");

const { state, saveState } = useSingleFileAuthState(sessionFilePath);
const sock = makeWASocket({ auth: state, logger: pino({ level: "silent" }) });

sock.ev.on("connection.update", async ({ connection, qr }) => {
  if (qr) {
    const qrPath = path.join(__dirname, "../public/qr.png");
    await qrcode.toFile(qrPath, qr);
  }
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

app.get("/session", (req, res) => {
  const zipPath = path.join(__dirname, "session.zip");
  if (fs.existsSync(zipPath)) {
    res.download(zipPath);
  } else {
    res.status(404).send("Session not ready");
  }
});

app.listen(PORT, () => console.log("Server running on port", PORT));
