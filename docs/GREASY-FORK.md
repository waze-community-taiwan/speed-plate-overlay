# Publishing and automatic updates

The source repository is `waze-community-taiwan/speed-plate-overlay`. The published script is [Taiwan Speed Plate Overlay](https://greasyfork.org/en/scripts/605482-taiwan-speed-plate-overlay), script ID `605482`.

## Current setup

The repository is public. Script `605482` is configured to synchronize its code from the latest GitHub Release asset and its additional information from `docs/GREASY-FORK-LISTING.md` on `main`. A GitHub webhook sends release events with the existing Greasy Fork signing secret; SSL verification is enabled. The initial `v0.1.0` workflow completed successfully. No manual GitHub setup is required for the current repository. The instructions below explain how to recreate or maintain the configuration.

## Release flow

1. Push or merge a change into `main`. Feature branches and pull requests run checks without publishing.
2. The **Release** workflow resolves a version, runs type checks, unit tests, release tests, builds the userscript, and runs Chromium fixture tests against that version.
3. The first release uses `package.json` (initially `0.1.0`). Later releases increment the patch from the highest stable package/tag version. A manually increased package version is honored. Use **Actions → Release → Run workflow** on `main` to request a minor/major bump or an explicit higher version.
4. The workflow commits `package.json`, `package-lock.json`, and the tested root `wme-speed-plate-overlay.user.js`, then atomically pushes `main` and its version tag. A newer user push is never overwritten. Superseded queued runs are skipped; the newest push has its own run.
5. It creates a GitHub Release containing the same standalone bundle and generated release notes. The package version also appears in the userscript metadata and sidebar footer.
6. Greasy Fork fetches the committed bundle from the GitHub Release asset via its release webhook. Tampermonkey handles installed-script updates from Greasy Fork.

Builds are readable, unminified, below 2 MB, and do not use runtime loaders or external source maps. No CSV files or browser profiles are published. `dist/` is local build output; the root bundle is the distribution file tracked in Git.

## Greasy Fork setup

Create the script from the built userscript and set its synchronization URL to:

```
https://github.com/waze-community-taiwan/speed-plate-overlay/releases/latest/download/wme-speed-plate-overlay.user.js
```

Keep the script's primary locale English (matching its name and description). The plugin interface defaults to Traditional Chinese; it also includes English. The source-code license is MIT; government CSV datasets retain their own licenses.

In your Greasy Fork account's **Set up a webhook** page, use the GitHub instructions to create a webhook for this repo. Copy the displayed payload URL and secret exactly; keep the secret out of source control. Enable SSL verification and JSON payloads. Select **Let me select individual events**, uncheck Pushes, and check **Releases**. This follows NLSC Overlay’s release-asset synchronization practice and publishes only after the release asset exists. The workflow uses the built-in `GITHUB_TOKEN`; no Greasy Fork password, cookies, or personal token belongs in Actions.

The repo must be public so Greasy Fork can fetch the bundle. A private source repo needs a separate public distribution mechanism.

## GitHub settings

- Enable Actions and allow the actions referenced in `.github/workflows/`.
- The Release workflow explicitly requests `contents: write`; a read-only default is sufficient if organization policy permits that request.
- Any protection/ruleset on `main` must allow the release bot to push version commits, or switch to a release-PR design. Do not disable protections simply to fix a release.
- Webhooks require repository admin access. Set the Greasy Fork payload URL and secret once in **Settings → Webhooks**. Inspect a successful delivery after publication.
- No Pages, npm publishing, PAT, or Actions approval-of-PR setting is required.

After a bot version commit, run `git pull --ff-only` before the next local change/push. The token's own commits do not recursively start Actions runs.

## Recovery

Failed validation publishes nothing. If a newer push arrives while checks run, the atomic push may fail safely; let the newer run finish. If GitHub Release creation fails after the version commit/tag were pushed, choose **Re-run all jobs** on that same run. Its run ID in the version commit allows the job to reuse the existing version/tag. If a later release has already superseded it, the older retry skips. Do not delete published tags or reduce versions to roll back: restore the desired code in a new commit and publish a higher version.

Greasy Fork synchronizes the tested asset when the GitHub Release is published. The root bundle remains tracked for inspection, but source pushes alone do not publish unfinished code. A sync failure does not erase a release. Use the script's synchronization page to sync again after checking webhook deliveries. Disabling the webhook stops immediate synchronization; also disable any scheduled automatic synchronization when pausing publication.

Official references: [Greasy Fork API and webhooks](https://greasyfork.org/en/help/api), [Greasy Fork code rules](https://greasyfork.org/en/help/code-rules), [GitHub workflow triggers and token recursion](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow).
