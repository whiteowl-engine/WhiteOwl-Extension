# Privacy

## Summary

The WhiteOwl Extension is designed as a local companion to the WhiteOwl panel. It stores operational state in browser extension storage and connects to a configured WhiteOwl backend for features that require panel/runtime support.

## Local Storage

The extension can store the following data locally:

- Approved site connections
- Active backend URL override
- Wallet setup state
- Encrypted keystore and related wallet metadata
- PIN state and local session flags
- Chat/session UI state
- Operational feature flags needed by the side panel

## Network Activity

The extension can send requests to a configured WhiteOwl backend for features such as:

- Token analysis and enrichment
- Image scan requests
- Page safety or drainer scan workflows
- Wallet-related backend-assisted flows
- Panel chat/runtime integration

By default the backend target is `http://localhost:3377` unless the user changes `chrome.storage.local.wo_server_url`.

## Consent Model

The codebase includes a consent gate intended to block provider activation and page data collection until the user has accepted the in-extension disclosure.

## No Built-In Analytics

This repository does not add a dedicated analytics SDK or hardcoded telemetry endpoint. Any effective network processing depends on the configured WhiteOwl backend and the flows the user actively triggers.

## Operational Guidance

- Keep the backend local when possible.
- Review requested permissions before loading the extension.
- Clear extension storage if you want to remove saved approvals, keystore state and local settings.

## Open Source Review

This repository is published so storage, provider, scanner and wallet flows can be inspected directly. Review the code before using it with sensitive accounts or real funds.