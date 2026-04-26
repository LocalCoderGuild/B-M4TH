#!/bin/sh
set -e

for f in /usr/share/nginx/html/assets/*.js; do
  sed -i \
    -e "s|__VITE_PUBLIC_URL__|${VITE_PUBLIC_URL:-}|g" \
    -e "s|__VITE_ENGINE_URL__|${VITE_ENGINE_URL:-}|g" \
    -e "s|__VITE_API_URL__|${VITE_API_URL:-}|g" \
    "$f"
done
