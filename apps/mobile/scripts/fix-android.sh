#!/bin/bash
# Patches the generated android/ directory after expo prebuild.
# Run manually after any `expo prebuild --clean`, or use `npm run prebuild:android`.

set -e

ANDROID_DIR="$(dirname "$0")/../android"

# Write local.properties with SDK path (regenerated clean by prebuild)
echo "sdk.dir=$HOME/Library/Android/sdk" > "$ANDROID_DIR/local.properties"
echo "✓ local.properties written"

# Patch foojay for Gradle 9 compatibility
node "$(dirname "$0")/patch-foojay.js"
