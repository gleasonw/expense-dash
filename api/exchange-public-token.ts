import { plaidClient } from "@/server/plaid";
import { withIronSessionApiRoute } from "iron-session/next";

// todo start session using the lucia guidelines

async function exchangePublicToken(req, res) {
  const exchangeResponse = await plaidClient.itemPublicTokenExchange({
    public_token: req.body.public_token,
  });

  req.session.access_token = exchangeResponse.data.access_token;
  await req.session.save();
  res.send({ ok: true });
}
