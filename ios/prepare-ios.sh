#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node build-web.mjs
icons=generated/Assets.xcassets/AppIcon.appiconset
mkdir -p "$icons"
sips -z 1024 1024 --setProperty format png ../public/icon-512.png --out "$icons/AppIcon.png" >/dev/null
cat > generated/Assets.xcassets/Contents.json <<'JSON'
{"info":{"author":"xcode","version":1}}
JSON
cat > "$icons/Contents.json" <<'JSON'
{"images":[{"filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"}],"info":{"author":"xcode","version":1}}
JSON
xcodegen generate --spec project.yml
