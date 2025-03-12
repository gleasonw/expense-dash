"use server";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import { plaidAccount, User, userTable } from "@/server/schema";
import { initializeSession, getCurrentSession } from "@/server/session";
import { eq } from "drizzle-orm";
import { ItemPublicTokenExchangeResponse } from "plaid";

/**create a user, create a session for the user, and return the session + the access token */
export async function exchangePublicToken({ token }: { token: string }) {
  let exchangeResponse: Awaited<
    ReturnType<typeof plaidClient.itemPublicTokenExchange>
  >;
  try {
    exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: token,
    });
  } catch (e) {
    console.error(e);
    return new Response(null, { status: 400 });
  }

  const { access_token, item_id } = exchangeResponse.data;

  const user = await getUser(exchangeResponse.data);

  return db
    .insert(plaidAccount)
    .values({
      access_token,
      item_id,
      user_id: user.id,
      created_at: new Date(),
    })
    .returning();
}

async function getUser(data: ItemPublicTokenExchangeResponse): Promise<User> {
  const sessionUser = await getCurrentSession();
  if (sessionUser.user) {
    // we have a session, so we can just return the user
    return sessionUser.user;
  }

  // user will be keyed to an institution!
  const test = await plaidClient.identityGet({
    access_token: data.access_token,
  });

  console.log(test.data);

  //todo: this doesn't work, existing user will never be found since item_id changes for each plaid auth flow. need to use
  // identity api and search for the user by email
  const existingUser = await db
    .select()
    .from(plaidAccount)
    .where(eq(plaidAccount.item_id, data.item_id));

  if (existingUser.length > 0) {
    // we have a user, just need to create a session
    const user = existingUser[0];
    await initializeSession(user.id);
    return user;
  } else {
    // user is new
    const [newUser] = await db.insert(userTable).values({}).returning();
    await initializeSession(newUser.id);
    return newUser;
  }
}
