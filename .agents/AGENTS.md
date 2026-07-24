# Agent Guidelines

## Monorepo & Package Management
* **Runtime & Package Manager:** Always use `bun` (v1.1+) for JS/TS dependency management and running scripts across workspaces (`packages/backend`, `packages/frontend`). Do NOT use `npm` or `yarn`.

## Sandbox Egress & Command Executions
* **Do NOT execute the following test/seeding commands inside the terminal sandbox:**
  - `bun run cleanup` (or `bun --filter backend cleanup`)
  - `bun run seed`
  - `bun run test:local-worker`
* **Reason:** The terminal sandbox restricts outgoing DNS resolution to external APIs like OMOPHub (`api.omophub.com`). Running these scripts inside the sandbox will cause network/DNS failures and corrupt database entry states. Always ask the user to execute these three commands in their host terminal.

## Architecture & Data Modeling
* **Backend Framework:** Elysia.js running on Bun.
* **DynamoDB Modeling:** Always use ElectroDB entities/models for database queries rather than raw AWS DynamoDB SDK calls.
* **Frontend-Backend API Contracts:** Use `@elysiajs/eden` for type-safe API consumption.

## AWS CLI, SAM & Data Inspection
* **AWS SSO Login:** Perform AWS CLI login/authentication via AWS SSO specifying the project profile (e.g., `aws sso login --profile ehr-dev`).
* **SSO Token Scope & Data Inspection:** Understand that the AWS token obtained via AWS SSO is strictly for the **data plane** (not control plane). Use the AWS CLI to inspect and verify data resources in AWS Infrastructure (e.g., S3, DynamoDB).
* **SAM Emulation:** Refer to `template.yaml` for AWS resource definitions and use `sam build` / `sam local` when testing Lambda infrastructure locally.

## Git & GitHub Workflow
* **Restricted Main Branch:** Direct pushes to `main` are strictly prohibited.
* **Branch & PR Strategy:** Always create a feature/bugfix branch and use the GitHub CLI (`gh`) to create branches and open Pull Requests for code changes.
* **PR CI & Automated Review Inspection:** After creating or pushing to a Pull Request, always monitor and verify that GitHub Actions CI checks pass (`gh pr checks`) and inspect automated review feedback (such as Greptile reviews via `gh pr view --comments`). Proactively address any build failures or valid security/logic findings before completing the task.

## Testing, Linting & Python Tooling
* **JS/TS Testing & Linting:** Run tests via `bun test` and linting via `bun run lint`.
* **Python/ML Tooling (`ml/` directory):** Use `uv` for python dependency/environment management and `ruff` for linting and formatting.
