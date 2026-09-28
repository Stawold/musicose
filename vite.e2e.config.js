// Config Vite réservée aux tests de bout en bout : PeerJS est remplacé par un faux en mémoire.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { peerjs: path.resolve('tests/e2e/fakePeer.js') } },
})
