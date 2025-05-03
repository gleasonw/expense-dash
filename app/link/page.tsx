import { PlaidLinkComponent } from "@/app/PlaidLink";
import { plaidClient } from "@/server/plaid";
import { CountryCode, Products } from "plaid";

export default async function Link() {
  if (!process.env.PLAID_CLIENT_ID) {
    return "check server";
  }
  let tokenResponse;
  try {
    tokenResponse = await plaidClient.linkTokenCreate({
      user: { client_user_id: process.env.PLAID_CLIENT_ID },
      client_name: "Plaid's Tiny Quickstart",
      language: "en",
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      redirect_uri: process.env.PLAID_SANDBOX_REDIRECT_URI,
    });
  } catch (e) {
    if (e instanceof Error) {
      console.log(e.message);
    }
  }

  if (!tokenResponse) {
    return "check server";
  }

  return <PlaidLinkComponent link_token={tokenResponse.data.link_token} />;
}
