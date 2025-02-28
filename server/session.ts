import { sha256 } from "@oslojs/crypto/sha2";
import { db } from "./db";
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import {
  sessionTable,
  plaidAccount,
  userTable,
  User,
  Session,
} from "@/server/schema";

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}

const SESSION_EXPIRATION_MILLISECONDS = 1000 * 60 * 60 * 24 * 30;

/**does everything for session creation. if we need to break this into parts (db persistence, cookie persistence),
 * can do so later.
 */
export async function initializeSession(userId: number) {
  const token = generateSessionToken();
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + SESSION_EXPIRATION_MILLISECONDS),
  };
  await db.insert(sessionTable).values(session);
  setSessionTokenCookie(token, session.expiresAt);
}

async function setSessionTokenCookie(token: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    expires: expiresAt,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/**cached validation to avoid incurring multiple db calls. probably not that necessary */
export const getCurrentSession = cache(async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ?? null;
  console.log("checking session", token);
  if (token === null) {
    return { session: null, user: null };
  }
  return validateSessionToken(token);
});

/** we throw here since we assume the layout has already checked that the user is logged in */
export const getUserWithToken = cache(async () => {
  const sessionUser = await getCurrentSession();
  if (!sessionUser.user) {
    throw new Response(null, { status: 404 });
  }
  const res = await db
    .select()
    .from(plaidAccount)
    .where(eq(plaidAccount.user_id, sessionUser.user.id));
  if (res.length === 0) {
    // i don't think this should ever happen?
    console.error("no plaid accounts found for user", { sessionUser });
    throw new Response(null, { status: 404 });
  }
  return {
    user: sessionUser.user,
    plaidAccount: res[0],
  };
});

export async function deleteSessionTokenCookie() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function validateSessionToken(
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
