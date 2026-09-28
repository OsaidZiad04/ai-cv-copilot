# Contributing

1. Pull the latest `main`: `git checkout main` and `git pull origin main`.
2. Create a focused branch: `git switch -c feature/short-description`.
3. Make the change and keep the provider, domain logic, and UI responsibilities clear.
4. Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.
5. Push your branch and open a pull request against `main`. Explain the change, tests, and any UI or print evidence.

Do not commit `.env.local`, API keys, or real candidate personal data. Use synthetic profiles for tests and screenshots. Have another engineer review production configuration or privacy changes before merging.
