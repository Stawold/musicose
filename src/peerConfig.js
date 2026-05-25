// Configuration PeerJS centralisée
// Dev    : utilise le serveur local sur le port 9000
// Prod   : définir VITE_PEER_HOST=monserveur.com (et optionnel VITE_PEER_PORT)
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
  : {
      host: window.location.hostname,
      port: 9000,
      path: '/peerjs',
      secure: false,
    };
