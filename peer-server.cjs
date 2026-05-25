// Serveur PeerJS local (port 9000)
// Démarrage : node peer-server.cjs
const { PeerServer } = require('peer');

const server = PeerServer({ port: 9000, path: '/peerjs' });

server.on('connection', (client) => {
  console.log(`[PeerJS] connecté  : ${client.getId()}`);
});
server.on('disconnect', (client) => {
  console.log(`[PeerJS] déconnecté: ${client.getId()}`);
});

console.log('PeerJS server démarré sur le port 9000 (path: /peerjs)');
