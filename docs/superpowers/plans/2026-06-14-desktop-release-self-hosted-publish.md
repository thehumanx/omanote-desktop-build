# Desktop Release Self-Hosted Publish Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the desktop release publish step run on a self-hosted runner so GitHub Actions billing blocks do not stop a release from being published.

**Architecture:** Keep the existing GitHub-hosted build matrix unchanged so artifact creation still happens in the same place. Move only the `publish` job to a self-hosted runner, where it will download the already-built artifacts, generate `latest.json`, and create the public release in `omanote-releases`. Update the release docs to explain the new fallback path.

**Tech Stack:** GitHub Actions YAML, Markdown documentation, GitHub CLI, jq

---

### Task 1: Move desktop publish to a self-hosted runner

**Files:**
- Modify: `.github/workflows/desktop-build.yml`

- [ ] **Step 1: Update the publish job runner**

```yaml
  publish:
    if: startsWith(github.ref, 'refs/tags/desktop-v')
    needs: build
    runs-on: self-hosted
```

- [ ] **Step 2: Add a short comment explaining why publish is self-hosted**

```yaml
  # The build matrix stays on GitHub-hosted runners, but publish runs on a
  # self-hosted runner so a GitHub Actions billing block cannot stop release
  # publication after artifacts are already built.
```

- [ ] **Step 3: Verify the workflow still keeps build and publish separated**

Run:

```sh
sed -n '1,220p' .github/workflows/desktop-build.yml
```

Expected: `build` still uses `ubuntu-22.04`, `windows-latest`, and `macos-latest`; `publish` uses `self-hosted`.

### Task 2: Update root release instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the self-hosted publish fallback to the desktop release section**

```md
If GitHub Actions billing blocks the publish job, keep the build artifacts from the workflow run and rerun only the `publish` job on a self-hosted runner, or publish manually with `gh release create` from a machine that can reach GitHub.
```

- [ ] **Step 2: Keep the existing release flow accurate**

```md
3. `git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z`

CI builds Windows (.msi/.exe), macOS (universal .dmg), and Linux (.deb/.rpm/.AppImage) and publishes them to the releases repo automatically (~30 min). If the publish job is blocked by billing, rerun only that job on a self-hosted runner or use the manual `gh release` fallback.
```

- [ ] **Step 3: Verify the prose still matches the workflow**

Run:

```sh
sed -n '40,60p' README.md
```

Expected: the release section mentions the self-hosted fallback and still describes the same desktop release flow.

### Task 3: Update the desktop app README

**Files:**
- Modify: `apps/desktop/README.md`

- [ ] **Step 1: Add the self-hosted publish fallback to the release notes**

```md
On `desktop-v*` tags the build matrix still runs on GitHub-hosted runners, but the `publish` job now runs on a self-hosted runner so a billing block cannot stop publication after the installers are already built.
```

- [ ] **Step 2: Keep the manual release flow documented**

```md
Release flow: bump the version in `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json`, commit, then `git tag desktop-vX.Y.Z && git push origin desktop-vX.Y.Z`.
```

- [ ] **Step 3: Verify the README still describes the installer outputs and updater path correctly**

Run:

```sh
sed -n '60,140p' apps/desktop/README.md
```

Expected: the auto-update and installer descriptions still match the workflow after the publish fallback note.
