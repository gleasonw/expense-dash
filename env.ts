export const IS_LOCAL_HOST =
  typeof window !== "undefined"
    ? ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
    : process.env.NODE_ENV === "development";
