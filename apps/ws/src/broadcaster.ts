/**
 * Broadcaster — gère le set de connexions WebSocket actives et diffuse
 * les événements live à tous les clients connectés.
 *
 * Inspiré de `LiveBroadcaster` du dépôt B (server.py:88-113), porté en TS
 * pour Fastify + @fastify/websocket.
 */

import type { WebSocket } from 'ws';
import type { LiveEvent, Role } from '@tt/types';

interface Client {
  socket: WebSocket;
  role: Role;
  connectedAt: number;
}

export class Broadcaster {
  private readonly clients: Set<Client> = new Set();

  add(socket: WebSocket, role: Role = 'visitor'): Client {
    const client: Client = { socket, role, connectedAt: Date.now() };
    this.clients.add(client);
    return client;
  }

  remove(client: Client): void {
    this.clients.delete(client);
  }

  removeBySocket(socket: WebSocket): void {
    for (const c of this.clients) {
      if (c.socket === socket) {
        this.clients.delete(c);
        return;
      }
    }
  }

  /** Diffuse un événement à tous les clients connectés. */
  broadcast(event: LiveEvent): void {
    const payload = JSON.stringify(event);
    const dead: Client[] = [];
    for (const c of this.clients) {
      try {
        if (c.socket.readyState === 1 /* OPEN */) {
          c.socket.send(payload);
        } else {
          dead.push(c);
        }
      } catch {
        dead.push(c);
      }
    }
    for (const c of dead) this.clients.delete(c);
  }

  size(): number {
    return this.clients.size;
  }

  /** Snapshot léger pour l'endpoint /metrics. */
  stats() {
    let visitors = 0;
    let players = 0;
    let staff = 0;
    for (const c of this.clients) {
      if (c.role === 'admin' || c.role === 'juge_arbitre') staff++;
      else if (c.role === 'player') players++;
      else visitors++;
    }
    return { total: this.clients.size, visitors, players, staff };
  }
}
