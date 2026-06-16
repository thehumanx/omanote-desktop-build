# omanote desktop build

This repo builds the omanote desktop app for Windows, macOS, and Linux via GitHub Actions.

On each push to `main` or manual workflow dispatch, the CI builds and uploads installers as artifacts.
Tag a commit with `desktop-v*` to publish a GitHub Release with auto-update support.
