"use server";
import { plaidClient } from "@/server/plaid";
import { db } from "@/server/db";
import { plaidAccount } from "@/server/schema";
import { getCurrentSession } from "@/server/session";

export async function exchangePublicToken({ token }: { token: string }) {
  let exchangeResponse: Awaited<
    ReturnType<typeof plaidClient.itemPublicTokenExchange>
  >;
  try {
    exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: token,
    });
  } catch (e) {
    throw new Error(
      "Error exchanging public token. Please check your token and try again."
    );
  }

  const { access_token, item_id } = exchangeResponse.data;

  const user = await getCurrentSession();

  if (!user.user?.id) {
    // I think this should never happen
    throw new Error(
      "user not found, I thought this was impossible, user should have logged in via oauth before linking plaid account"
    );
  }

  const response = await db
    .insert(plaidAccount)
    .values({
      access_token,
      item_id,
      user_id: user.user?.id,
      created_at: new Date(),
    })
    .returning();

  if (response.length === 0) {
    throw new Error("Error inserting plaid account into database");
  }
  return response[0]!;
}
