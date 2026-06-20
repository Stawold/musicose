// Configuration PeerJS centralisée
// Dev  : serveur local port 9000 (node peer-server.cjs)
// Prod : serveur public PeerJS (0.peerjs.com) — gratuit, P2P direct
//        Pour un serveur privé : définir VITE_PEER_HOST dans Netlify
const isDev = import.meta.env.DEV;
const customHost = import.meta.env.VITE_PEER_HOST;
const customPort = import.meta.env.VITE_PEER_PORT;

// STUN seul (config PeerJS par défaut) échoue derrière un NAT restrictif
// (ex. 4G/5G sur iPhone, certains Wi-Fi publics) : on ajoute des serveurs
// TURN (relais) publics pour que la connexion P2P puisse quand même
// s'établir dans ces cas-là.
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:openrelay.metered.ca:80' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

export const peerConfig = customHost
  ? {
      host: customHost,
      port: customPort ? parseInt(customPort) : 443,
      path: '/peerjs',
      secure: true,
      config: { iceServers },
    }
  : isDev
  ? {
      host: 'localhost',
      port: 9000,
      path: '/peerjs',
      secure: false,
      config: { iceServers },
    }
  : { config: { iceServers } }; // serveur cloud PeerJS public (0.peerjs.com) en production
