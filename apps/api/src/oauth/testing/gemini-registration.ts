export const geminiRegistration = {
  client_name: "Google",
  redirect_uris: [
    "https://oauth-redirect-sandbox.googleusercontent.com/r/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app",
    "https://oauth-redirect-test.googleusercontent.com/r/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app",
    "https://oauth-redirect.googleusercontent.com/r/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app",
    "https://oauth-redirect-sandbox.googleusercontent.com/a/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app",
    "https://oauth-redirect-test.googleusercontent.com/a/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app",
    "https://oauth-redirect.googleusercontent.com/a/user_bound_custom-mcp-f6492779cacd5f618adb99b9-studio_airdesign_app",
  ],
  response_types: ["code"],
  grant_types: ["authorization_code", "refresh_token"],
  token_endpoint_auth_method: "client_secret_post",
} as const

export const [, , geminiCallback] = geminiRegistration.redirect_uris
