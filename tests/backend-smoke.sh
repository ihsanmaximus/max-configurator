#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
COOKIE_JAR="$(mktemp)"
PNG_FILE="$(mktemp --suffix=.png)"
cleanup() { rm -f "$COOKIE_JAR" "$PNG_FILE"; }
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
expect_code() {
  local expected="$1"; shift
  local actual
  actual="$(curl -sS -o /tmp/maximus-smoke-response -w '%{http_code}' "$@")"
  if [[ "$actual" != "$expected" ]]; then
    cat /tmp/maximus-smoke-response >&2 || true
    fail "Expected HTTP $expected, got $actual for request: $*"
  fi
}
json() { cat /tmp/maximus-smoke-response; }

# A valid 1x1 PNG fixture.
printf '%s' 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=' | base64 -d > "$PNG_FILE"

expect_code 200 -c "$COOKIE_JAR" "$BASE_URL/backend/api/auth.php"
expect_code 200 -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d '{"password":"maximus-smoke-password"}' "$BASE_URL/backend/api/auth.php"
TOKEN="$(json | jq -r '.csrfToken // empty')"
[[ -n "$TOKEN" ]] || fail "Login did not return CSRF token"

# Mutating requests must reject an invalid CSRF token.
expect_code 403 -b "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' -H 'X-CSRF-Token: invalid' \
  -d '{"name":"Rejected project","config":{"project":{"name":"Rejected"}}}' \
  "$BASE_URL/backend/api/projects.php"

expect_code 201 -b "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $TOKEN" \
  -d '{"name":"Smoke Test","config":{"project":{"name":"Smoke Test"},"media":{"logo":null,"hero":null,"about":null,"expertise":null}}}' \
  "$BASE_URL/backend/api/projects.php"
PROJECT_ID="$(json | jq -r '.project.id // empty')"
[[ -n "$PROJECT_ID" ]] || fail "Project creation did not return ID"

expect_code 200 -b "$COOKIE_JAR" "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID"
jq -e '.config.project.name == "Smoke Test"' /tmp/maximus-smoke-response >/dev/null || fail "Project read mismatch"

expect_code 201 -b "$COOKIE_JAR" -X POST \
  -H "X-CSRF-Token: $TOKEN" -F "file=@$PNG_FILE;type=image/png" \
  "$BASE_URL/backend/api/media.php?project_id=$PROJECT_ID"
MEDIA_FILE="$(json | jq -r '.file // empty')"
[[ -n "$MEDIA_FILE" ]] || fail "Media upload did not return filename"

# Bind the uploaded asset, then delete it and verify references are cleared.
CONFIG="$(jq -n --arg id "$PROJECT_ID" --arg file "$MEDIA_FILE" '{project:{id:$id,name:"Smoke Test",package:"paket-2"},media:{logo:null,hero:{file:$file},about:null,expertise:null},sections:{}}')"
expect_code 200 -b "$COOKIE_JAR" -X PUT \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $TOKEN" \
  --data "$CONFIG" "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID"

expect_code 200 -b "$COOKIE_JAR" -X DELETE -H "X-CSRF-Token: $TOKEN" \
  "$BASE_URL/backend/api/media.php?project_id=$PROJECT_ID&file=$MEDIA_FILE"
expect_code 200 -b "$COOKIE_JAR" "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID"
jq -e '.config.media.hero == null' /tmp/maximus-smoke-response >/dev/null || fail "Deleting media did not clear config reference"

expect_code 200 -b "$COOKIE_JAR" "$BASE_URL/backend/api/media.php?project_id=$PROJECT_ID&action=backups"
jq -e --arg file "$MEDIA_FILE" '.backups | any(.file == $file)' /tmp/maximus-smoke-response >/dev/null || fail "Media backup missing"

expect_code 200 -b "$COOKIE_JAR" -X POST -H "X-CSRF-Token: $TOKEN" \
  "$BASE_URL/backend/api/media.php?project_id=$PROJECT_ID&action=restore&file=$MEDIA_FILE"
expect_code 200 -b "$COOKIE_JAR" "$BASE_URL/backend/api/media.php?project_id=$PROJECT_ID&file=$MEDIA_FILE"
expect_code 200 -b "$COOKIE_JAR" "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID&action=backups"
BACKUP_FILE="$(jq -r '.backups[0].file // empty' /tmp/maximus-smoke-response)"
[[ -n "$BACKUP_FILE" ]] || fail "Config backup missing"

# Restore media first, then restore the config snapshot that references it.
expect_code 200 -b "$COOKIE_JAR" -X POST \
  -H 'Content-Type: application/json' -H "X-CSRF-Token: $TOKEN" \
  -d "$(jq -n --arg file "$BACKUP_FILE" '{file:$file}')" \
  "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID&action=restore"
expect_code 200 -b "$COOKIE_JAR" "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID"
jq -e --arg file "$MEDIA_FILE" '.config.media.hero.file == $file' /tmp/maximus-smoke-response >/dev/null || fail "Config backup restore failed"

expect_code 200 -b "$COOKIE_JAR" -X DELETE -H "X-CSRF-Token: $TOKEN" \
  "$BASE_URL/backend/api/projects.php?id=$PROJECT_ID"
expect_code 200 -b "$COOKIE_JAR" -X DELETE -H "X-CSRF-Token: $TOKEN" \
  "$BASE_URL/backend/api/auth.php"
expect_code 401 -b "$COOKIE_JAR" "$BASE_URL/backend/api/projects.php"

echo "PASS: auth, CSRF, project CRUD, media upload/delete/restore, config backup/restore, logout."
