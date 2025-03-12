import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
const plaidEnv = process.env.PLAID_ENV;
const plaidClientId = process.env.PLAID_CLIENT_ID;
const plaidSecret = process.env.PLAID_SECRET;

if (!plaidEnv || !plaidClientId || !plaidSecret) {
  console.log({ plaidEnv, plaidClientId, plaidSecret });
  throw new Error(
    "Please set your Plaid environment, client ID, and secret in your .env file."
  );
}

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": plaidClientId,
        "PLAID-SECRET": plaidSecret,
        "Plaid-Version": "2020-09-14",
      },
    },
  })
);

export { plaidClient };
