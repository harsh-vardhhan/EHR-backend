# Agent Guidelines

## Sandbox Egress & Command Executions
* **Do NOT execute the following test/seeding commands inside the terminal sandbox:**
  - `npm run cleanup`
  - `npm run seed`
  - `npm run test:local-worker`
* **Reason:** The terminal sandbox restricts outgoing DNS resolution to external APIs like OMOPHub (`api.omophub.com`). Running these scripts inside the sandbox will cause network/DNS failures and corrupt database entry states. Always ask the user to execute these three commands in their host terminal.

## AWS CLI & Authentication
* **AWS SSO Login:** Perform AWS CLI login/authentication via AWS SSO (e.g., `aws sso login`).
* **SSO Token Scope:** Understand that the AWS token obtained via AWS SSO is strictly for the **data plane** and not the control plane.

## Python & ML Tooling (ml/ directory)
* **Package/Environment Management:** Use `uv` for python dependency and environment management.
* **Linting & Formatting:** Use `ruff` for linting and formatting python code.
