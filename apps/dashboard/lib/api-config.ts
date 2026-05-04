const DEV_API_URL = "http://localhost:4000";

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiUrlConfig() {
  const configured = process.env.NEXT_PUBLIC_ATMA_API_URL?.trim();

  if (configured) {
    return {
      apiUrl: stripTrailingSlash(configured),
      configError: null
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      apiUrl: null,
      configError:
        "NEXT_PUBLIC_ATMA_API_URL is required in production. Set it to your public API base URL, for example https://api.atma.yourdomain.com."
    };
  }

  return {
    apiUrl: DEV_API_URL,
    configError: null
  };
}
