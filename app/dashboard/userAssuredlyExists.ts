"use server";

import { getCurrentSession } from "@/server/session";

export async function userAssuredlyExists() {
  const userSession = await getCurrentSession();
  if (!userSession.user) {
    // this should never happen since our layout should catch users that aren't
    // logged in
    throw new Response(null, { status: 404 });
  }
  return userSession.user;
}
