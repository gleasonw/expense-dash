import { PlaidLinkComponent } from "@/app/PlaidLink";
import { plaidClient } from "@/server/plaid";
import { CountryCode, Products } from "plaid";

export default async function Link() {
  if (!process.env.PLAID_CLIENT_ID) {
    return "check server, no plaid client id";
  }
  if (!process.env.PLAID_SECRET) {
    return "check server, no plaid secret";
  }
  if (!process.env.PLAID_REDIRECT_URI) {
    return "check server, no plaid redirect uri";
  }
  let tokenResponse;
  try {
    tokenResponse = await plaidClient.linkTokenCreate({
      user: { client_user_id: process.env.PLAID_CLIENT_ID },
      client_name: "Plaid's Tiny Quickstart",
      language: "en",
      products: [Products.Auth, Products.Transactions],
      country_codes: [CountryCode.Us],
      redirect_uri: process.env.PLAID_REDIRECT_URI,
    });
  } catch (e) {
    console.log(process.env);
    console.log(e.response);
    if (e instanceof Error) {
      console.log(e.message);
    }
  }

  if (!tokenResponse) {
    return "check server, no token response";
  }

  return <PlaidLinkComponent link_token={tokenResponse.data.link_token} />;
}
