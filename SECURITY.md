# Security Policy

## Scope

This repository includes browser extension code that touches:

- Wallet/provider injection
- Site approval state
- Page inspection and scanner flows
- Local keystore and PIN-protected wallet state
- Backend-assisted wallet and token actions

## Reporting

Do not post active exploit details, key exfiltration paths, or reproducible attack chains in a public issue.

Use a private GitHub security advisory or contact the maintainers through a non-public channel first. Public issues are acceptable only for low-risk bugs that do not expose users, wallets, or connected sites.

## Hardening Guidance

- Review all injected-provider and signing flows before production use.
- Do not use untrusted backend URLs for wallet-related operations.
- Treat this extension as security-sensitive software and test it in a clean browser profile.
- Do not rely on the codebase as independently audited wallet software unless an explicit audit has been published.

## User Safety Notice

If you use this repository with real funds, do so only after your own code review and environment review. A browser extension that injects providers and handles wallet actions has a materially higher risk profile than a passive UI extension.