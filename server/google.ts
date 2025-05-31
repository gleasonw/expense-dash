import { Google } from "arctic";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    `Please set your Google client ID and secret in your .env file.`
  );
}

console.log(process.env.RAILWAY_PUBLIC_DOMAIN);

export const google = new Google(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000/login/google/callback"
    : // need to update in google cloud console auth client if this changes...
      // could i use pulumi?
      `${process.env.RAILWAY_PUBLIC_DOMAIN}/login/google/callback`
);
