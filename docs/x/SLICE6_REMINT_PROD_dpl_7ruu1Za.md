# Slice 6 + remint Production — dpl_7ruu1Za

- Commit: `058c145` feat(launch): pfp + X-post origin; no g589/MOMENT prompt defaults
- Deployment: `dpl_7ruu1ZaNsLSaHkGqdTa5FheD2KrA`
- Alias: https://graav.xyz
- Remint: local REMINT_PASS @graav_xyz; Production sensitive envs patched pre-deploy

## Smoke

- GET / → 200 (dpl_7ruu1Za in CSS)
- GET /launch → 200; Factory `0xd2b7…`; UI strings: Token image, origin is recorded, TICKER placeholder; no g589/$MOMENT defaults
- POST /api/x/refresh-token (cron) → ok:true (in-memory); vercelPersist 403 from runtime token (local PATCH already done)
