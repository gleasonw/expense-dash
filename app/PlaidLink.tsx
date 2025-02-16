"use client";

import { exchangePublicToken } from "@/server/exchangePublicToken";
import { PlaidLink } from "react-plaid-link";

export function PlaidLinkComponent({ link_token }: { link_token: string }) {
  return (
    <PlaidLink
      className="CustomButton"
      style={{ padding: "20px", fontSize: "16px", cursor: "pointer" }}
      token={link_token} // Provide a default value
      onSuccess={async (public_token, metadata) => {
        console.log("public token", public_token);
        console.log(metadata);
        // Send the public_token to your server to exchange it for an access_token
        try {
          const { access_token } = await exchangePublicToken({
            token: public_token,
          });

          console.log("Access token exchange response:", access_token);
          // Handle success (e.g., store the access_token securely)
        } catch (error) {
          console.error("Error exchanging public token:", error);
          // Handle error appropriately
        }
      }}
      onEvent={(event) => console.log("Link event:", event)}
      onExit={(event) => console.log("Link exit event:", event)}
    >
      Link your bank account
    </PlaidLink>
  );
}
