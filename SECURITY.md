# Security policy

## Reporting a vulnerability

Please do not publish a working exploit in a public issue. Report security
problems through GitHub's **Security → Report a vulnerability** flow for this
repository. Include affected versions, reproduction steps, impact, and any
suggested mitigation.

## Data and network boundaries

- Library names, owned AppIDs, SteamID, account information, and machine IDs are
  not sent to the Store service.
- If an online server is configured, the plugin sends only the normalized search
  query and result limit. Returned public AppIDs are intersected with the local
  Library on-device.
- Store search is opt-in and the server field is user-controlled.
- The project has no analytics, account system, Windows service, or independent
  resident process.

Server operators must keep `STEAM_WEB_API_KEY` out of source control, terminate
TLS at a trusted reverse proxy, restrict CORS origins, apply request rate limits,
and keep Node.js and container dependencies patched.
