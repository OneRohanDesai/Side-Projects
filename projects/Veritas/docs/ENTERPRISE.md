# VERITAS Enterprise (Phase 7)

## Defaults

| Account | Password | Role |
| --- | --- | --- |
| admin | veritas-admin | Admin |
| sre | veritas-sre | SRE |
| viewer | veritas-viewer | Viewer |

Change passwords before any production exposure.

## Offline license

```bash
# Mint (dev signing key in appliance bootstrap only)
curl -s -X POST http://127.0.0.1:7420/v1/license/mint \
  -H 'Content-Type: application/json' \
  -d '{"customer_id":"acme","bind_machine":true}' > /tmp/veritas-license.json

# Install
curl -s -X POST http://127.0.0.1:7420/v1/license/install \
  -H 'Content-Type: application/json' \
  -d "{\"license_json\":$(python3 -c 'import json;print(json.dumps(open("/tmp/veritas-license.json").read()))')}"
```

Production: private signing key stays on vendor license server. Appliance holds verifying key only.

## Fleet agent

```bash
cd agents/veritas-agent
go run . -plane http://127.0.0.1:7420
```

## Desktop

See `desktop/README.md` for Tauri packaging.

## Air gap

- AI mode `deterministic` or `local`
- Offline license file
- Signed packs installed from media
- No mandatory cloud
