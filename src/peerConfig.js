// Configuration PeerJS centralisée
// Dev  : serveur local port 9000 (node peer-server.cjs)
// Prod : serveur public PeerJS (0.peerjs.com) — gratuit, P2P direct
//        Pour un serveur privé : définir VITE_PEER_HOST dans Netlify
const isDev = import.meta.env.DEV;
const customHost = import.meta.env.VITE_PEER_HOST;
const customPort = import.meta.env.VITE_PEER_PORT;

export const peerConfig = customHost
  ? {
      host: customHost,
      port: customPort ? parseInt(customPort) : 443,
      path: '/peerjs',
      secure: true,
    }
  : isDev
  ? {
      host: 'localhost',
      port: 9000,
      path: '/peerjs',
      secure: false,
    }
  : {}; // serveur cloud PeerJS public (0.peerjs.com) en production

