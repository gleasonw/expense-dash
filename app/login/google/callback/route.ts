import { initializeSession } from "@/server/session";
import { google } from "@/server/google";
import { cookies } from "next/headers";
import { decodeIdToken } from "arctic";

import type { OAuth2Tokens } from "arctic";
import { db } from "@/server/db";
import { eq } from "drizzle-orm";
import { userTable } from "@/server/schema";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieStore = await cookies();
    const storedState = cookieStore.get("google_oauth_state")?.value ?? null;
    const codeVerifier = cookieStore.get("google_code_verifier")?.value ?? null;
    if (
      code === null ||
      state === null ||
      storedState === null ||
      codeVerifier === null
    ) {
      return new Response(null, {
        status: 400,
      });
    }
    if (state !== storedState) {
      return new Response(null, {
        status: 400,
      });
    }

    let tokens: OAuth2Tokens;
    try {
      tokens = await google.validateAuthorizationCode(code, codeVerifier);
    } catch (e) {
      // Invalid code or client credentials
      console.log(e);
      return new Response(null, {
        status: 400,
      });
    }
    const claims = decodeIdToken(tokens.idToken()) as {
      sub: string;
      name: string;
    };
    const googleUserId = claims.sub;
    const username = claims.name;

    // TODO: Replace this with your own DB query.
    const existingUser = await db.query.userTable.findFirst({
      where: eq(userTable.googleId, googleUserId),
      with: { plaidAccounts: true },
    });

    if (existingUser !== undefined) {
      // why are we failing to set a cookie
      await initializeSession(existingUser.id);
      if (existingUser.plaidAccounts.length === 0) {
        return new Response(null, {
          status: 302,
          headers: {
            Location: "/link",
          },
        });
      }
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/dashboard",
        },
      });
    }

    const userResult = await db
      .insert(userTable)
      .values({
        googleId: googleUserId,
        name: username,
      })
      .returning();

    const user = userResult.at(0);

    if (!user) {
      console.error("Failed to create user after google oauth");
      return new Response(null, {
        status: 500,
      });
    }

    await initializeSession(user.id);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  } catch (e) {
    console.error("Error during Google OAuth callback:", e);
    return new Response(null, {
      status: 500,
      statusText: "Internal Server Error",
    });
  }
}
