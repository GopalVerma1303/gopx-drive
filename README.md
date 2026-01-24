<code>Personal drive for storing notes, files, & events.</code>

## EAS Web Hosting (Expo)

This project is configured for **EAS Hosting** with Expo Router.

### Requirements

- Install EAS CLI: `npm i -g eas-cli`
- In `app.json`, `expo.web.output` is set to `server` (supported by EAS Hosting).

### Deploy (manual)

Preview deployment:

- `npm run deploy:web`

Production deployment:

- `npm run deploy:web:prod`

### Deploy using EAS environment variables (recommended)

If you store variables in EAS Environments (preview/production), use these so:

- client-side `EXPO_PUBLIC_*` variables are injected during `expo export`
- server-side variables are included with the deployment
- > Note: EAS Hosting deployments are **immutable**. If you change an environment variable (for example, set `EXPO_PUBLIC_UI_DEV=false`), you must **re-export** and **re-deploy** for the change to take effect.

Preview:

- `npm run deploy:web:easenv:preview`

Production:

- `npm run deploy:web:easenv:prod`

Local-only deploys (use values from your local `.env`):

- Preview: `npm run deploy:web:local`
- Production: `npm run deploy:web:prod:local`

### Deploy automatically (EAS Workflows)

This repo includes `.eas/workflows/deploy-web.yml` which deploys **production web** on every push to the `main` branch.
