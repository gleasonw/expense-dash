"use server";
import { generateSessionToken } from "@/server/session";
import { cookies } from "next/headers";

/**create a user, create a session for the user, and return the session + the access token */
export async function exchangePublicToken({ token }: { token: string }) {
  // 1. check for session token, create user if does not exist

  // 2. create session

  // 2.5 set publicToken in session? no, call plaid api itemPublicTokenExchange,
  // set that token in plaid_accounts table, with link to user
  // https://github.com/plaid/tiny-quickstart/blob/main/nextjs/src/pages/api/exchange-public-token.js

  // 3. set session token in cookie
  const cookieStore = await cookies();
  // need probably some metadata from plaid to create the user?

  return { access_token: "access_token" };
}
