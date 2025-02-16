import { PlaidLinkComponent } from "@/app/PlaidLink";
import { plaidClient } from "@/plaid";
import { CountryCode, Products } from "plaid";

export default async function Home() {
  if (!process.env.PLAID_CLIENT_ID) {
    return "check server";
  }
  const tokenResponse = await plaidClient.linkTokenCreate({
    user: { client_user_id: process.env.PLAID_CLIENT_ID },
    client_name: "Plaid's Tiny Quickstart",
    language: "en",
    products: [Products.Auth, Products.Transactions],
    country_codes: [CountryCode.Us],
    redirect_uri: process.env.PLAID_SANDBOX_REDIRECT_URI,
  });
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <PlaidLinkComponent link_token={tokenResponse.data.link_token} />
    </div>
  );
}
