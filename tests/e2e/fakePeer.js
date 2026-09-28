// Faux PeerJS pour les tests de bout en bout : les "pairs" sont des onglets du même navigateur
// qui communiquent via BroadcastChannel (aucun réseau, aucun serveur PeerJS).
const rand = () => Math.random().toString(36).slice(2, 14).padEnd(12, 'x');

class Emitter {
  constructor() { this._h = {}; }
  on(evt, fn) { (this._h[evt] ||= []).push(fn); return this; }
  emit(evt, ...args) { (this._h[evt] || []).forEach(fn => fn(...args)); }
}

class DataConnection extends Emitter {
  constructor(owner, remoteId, connId) {
    super();
    this.owner = owner;
    this.peer = remoteId;
    this.connId = connId;
    this.open = false;
  }
  send(data) {
    if (this.owner._closed) return;
    this.owner._bc.postMessage({ kind: 'data', to: this.peer, from: this.owner.id, connId: this.connId, data });
  }
  close() {
    if (this.owner._closed) return;
    this.owner._bc.postMessage({ kind: 'close', to: this.peer, from: this.owner.id, connId: this.connId });
  }
}

export class Peer extends Emitter {
  constructor(id) {
    super();
    this.id = id || rand();
    this._conns = {};
    this._bc = new BroadcastChannel('fakepeer');
    this._bc.onmessage = ({ data: m }) => {
      if (this._closed || m.to !== this.id) return;
      if (m.kind === 'connect') {
        const c = new DataConnection(this, m.from, m.connId);
        this._conns[m.connId] = c;
        this.emit('connection', c);
        setTimeout(() => { c.open = true; c.emit('open'); }, 0);
        if (!this._closed) this._bc.postMessage({ kind: 'accept', to: m.from, from: this.id, connId: m.connId });
      } else if (m.kind === 'accept') {
        const c = this._conns[m.connId];
        if (c) { c.open = true; c.emit('open'); }
      } else if (m.kind === 'data') {
        const c = this._conns[m.connId];
        if (c) c.emit('data', m.data);
      } else if (m.kind === 'close') {
        const c = this._conns[m.connId];
        if (c) c.emit('close');
      }
    };
    setTimeout(() => this.emit('open', this.id), 0);
  }
  connect(remoteId) {
    const connId = rand();
    const c = new DataConnection(this, remoteId, connId);
    this._conns[connId] = c;
    if (this._closed) return c;   // pair détruit (double montage React en dev)
    this._bc.postMessage({ kind: 'connect', to: remoteId, from: this.id, connId });
    return c;
  }
  destroy() {
    Object.values(this._conns).forEach(c => c.close());
    this._closed = true;
    this._bc.close();
  }
}

export default Peer;
