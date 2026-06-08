# AGENTS.md

## Project purpose

Describe what this project does.

## Environment

- Runtime:
- Package manager:
- Database:
- Deployment method:

## Commands

Install:
- Add install command here.

Test:
- Add test command here.

Run dev:
- Add dev command here.

Build:
- Add build command here.

Deploy:
- Add deploy command here.

## Hermes rules

- Check git status before edits.
- Do not commit secrets.
- Do not commit .env files.
- Do not modify production config unless instructed.
- Create branches using hermes/<change-name>.
- Run tests before PR when test command exists.
- Create PR instead of direct push for production.
- Update README/docs if behavior changes.

## Files Hermes should avoid

- .env
- .env.*
- secrets.*
- private keys
- production credential files
- large generated files
