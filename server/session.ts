import { sha256 } from "@oslojs/crypto/sha2";
import { type User, type Session, db, sessionTable, userTable } from "./db";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { eq } from "drizzle-orm";

export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

const SESSION_EXPIRATION_MILLISECONDS = 1000 * 60 * 60 * 24 * 30;

export async function createSession(
  token: string,
  userId: number
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MILLISECONDS),
  };
  await db.insert(sessionTable).values(session);
  return session;
}

export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const result = await db
    .select({ user: userTable, session: sessionTable })
    .from(sessionTable)
    .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(eq(sessionTable.id, sessionId));
  if (result.length < 1) {
    return { session: null, user: null };
  }
  const { session, user } = result[0];
  if (Date.now() >= session.expiresAt.getTime()) {
    await invalidateSession(sessionId);
    return { session: null, user: null };
  }
  if (
    Date.now() >=
    session.expiresAt.getTime() - SESSION_EXPIRATION_MILLISECONDS / 2
  ) {
    // refresh session
    session.expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MILLISECONDS);
    await db
      .update(sessionTable)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(sessionTable.id, sessionId));
  }
  return { session, user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId));
}

export async function invalidateAllSessions(userId: number): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId));
}

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null };
