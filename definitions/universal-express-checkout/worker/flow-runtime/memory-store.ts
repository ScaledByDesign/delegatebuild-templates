/**
 * In-memory SessionStore — reference implementation for tests and a safe
 * fallback. Production workers should use a Durable Object or KV-backed store
 * so the optimistic version lock survives across requests/instances.
 */

import type { RuntimeSession, SessionStore } from "./types";

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, RuntimeSession>();

  async get(sessionId: string): Promise<RuntimeSession | null> {
    const s = this.sessions.get(sessionId);
    return s ? { ...s, journey: [...s.journey] } : null;
  }

  async create(session: RuntimeSession): Promise<RuntimeSession> {
    this.sessions.set(session.id, { ...session, journey: [...session.journey] });
    return session;
  }

  async update(
    sessionId: string,
    expectedVersion: number,
    patch: Partial<RuntimeSession>,
  ): Promise<RuntimeSession | null> {
    const current = this.sessions.get(sessionId);
    if (!current) return null;
    // Optimistic CAS — reject if the version moved under us.
    if (current.version !== expectedVersion) return null;
    const updated: RuntimeSession = { ...current, ...patch };
    this.sessions.set(sessionId, {
      ...updated,
      journey: [...updated.journey],
    });
    return updated;
  }
}
