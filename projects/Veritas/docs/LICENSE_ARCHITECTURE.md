# License Architecture

## Reality check
If the customer has the binary and the machine, software cannot be made mathematically uncopyable.  
Goal: make piracy **commercially unattractive**, protect crown-jewel algorithms in native code, and enforce **entitlements**.

## Modes

| Mode | Description |
| --- | --- |
| Free | Unlimited time, limited nodes/retention/seats, basic analytics |
| Pro | More scale, advanced intelligence, advanced reports |
| Enterprise | Offline license, SSO/RBAC/audit/HA, fleet, support |

## Components

```
 LICENSE SERVER (vendor)
        │  signs entitlement certificate
        ▼
 CUSTOMER MACHINE
   License Agent
     ├── entitlement parse + verify (public key only)
     ├── machine / install binding
     └── gate features in PRODUCT CORE
```

## Certificate fields

```text
customer_id
license_id
edition                # free | pro | enterprise
expiry
max_seats
max_nodes
max_agents
max_storage_gb
enabled_modules[]      # why, forecast, cost, security, ai_advanced, …
ai_features
support_level
signature              # ed25519
```

## Binding strategy
**Do not** use MAC address alone.

Prefer:
```
TPM-backed device key (when available)
+ machine identity
+ installation UUID
+ cryptographic keypair
```

Enterprise offline: signed license file installed by admin — no phone-home required.

## Implementation (this repo)
- `veritas-license` crate: types + verification stubs + sample free entitlement
- Private signing key **never** in repo
- Public verification key placeholder for Phase 1 demo

## Anti-tampering (defense in depth)
- Signed binaries / updates (Sigstore-class)
- SBOM
- Runtime integrity checks
- Stripped release symbols
- Crown jewels in Rust native code (not Python/JS)
- Do **not** rely on anti-debug as primary boundary
