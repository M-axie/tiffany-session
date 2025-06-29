const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = './session/baileys.json';

module.exports = async (req, res) => {
  const { state, saveState } = useSingleFileAuthState(SESSION_PATH);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      res.status(200).json({ qr });
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) makeWASocket({ auth: state });
    }

    if (connection === 'open') {
      saveState();
      console.log('✅ WhatsApp connected!');
    }
  });
};
