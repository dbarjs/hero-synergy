#!/usr/bin/env bash
#
# Runs dbarjs-agent-app.sh end to end against a mock GitHub
# (dbarjs-agent-app.mock.mjs). A FIFO feeds the wizard's prompts, and curl
# plays the browser that GitHub redirects back to the callback server.
#
#   bash scripts/dbarjs-agent-app.test.sh

# shellcheck disable=SC2016 # jq filters are single-quoted on purpose
set -euo pipefail

here=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
pids=()
cleanup() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  rm -rf "$tmp"
}
trap cleanup EXIT

passed=0
check() { # check "what" COMMAND... — one assertion
  if "${@:2}"; then
    passed=$((passed + 1))
    printf 'ok    %s\n' "$1"
  else
    printf 'FAIL  %s\n' "$1"
    printf -- '----- wizard output (%s) -----\n' "$name"
    cat "$tmp/$name.out" 2>/dev/null || true
    exit 1
  fi
}
contains() { grep -qF -- "$2" "$1"; }
no_secrets() { ! grep -rqe mock-client-secret -e mock-webhook-secret "$1"; }
env_has() { grep -qxF -- "$2" "$1/app.env"; }
# requests MOCK JQ_FILTER — how many logged requests match the filter
requests() { jq -s "[.[] | select($2)] | length" "$tmp/$1.mock.log"; }

free_port() {
  node -e 'const s = require("node:net").createServer().listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); })'
}

# start_mock NAME [VAR=VALUE...] — start a mock GitHub; sets MOCK_URL.
start_mock() {
  local mock="$1"
  env "${@:2}" MOCK_LOG="$tmp/$mock.mock.log" node "$here/dbarjs-agent-app.mock.mjs" >"$tmp/$mock.mock.port" &
  pids+=($!)
  for _ in $(seq 50); do [[ -s "$tmp/$mock.mock.port" ]] && break; sleep 0.1; done
  MOCK_URL="http://127.0.0.1:$(head -n1 "$tmp/$mock.mock.port")"
}

# start_wizard NAME DIR — run the wizard against MOCK_URL; fd 3 is its stdin.
start_wizard() {
  name="$1"
  WPORT=$(free_port)
  mkfifo "$tmp/$name.in"
  WIZARD_NO_TTY=1 WIZARD_API_URL="$MOCK_URL" WIZARD_GITHUB_URL=https://github.test \
    WIZARD_PORT="$WPORT" WIZARD_DIR="$2" BROWSER=true GH_TOKEN=gho_mustNotBeUsed \
    timeout 60 bash "$here/dbarjs-agent-app.sh" <"$tmp/$name.in" >"$tmp/$name.out" 2>&1 &
  WIZARD_PID=$!
  exec 3>"$tmp/$name.in"
}

# finish_wizard — close its stdin and wait; sets STATUS to its exit code.
finish_wizard() {
  exec 3>&-
  STATUS=0
  wait "$WIZARD_PID" || STATUS=$?
}

# open_form — wait for the callback server, then load the manifest page the
# way the browser would; sets PAGE, ACTION, STATE and MANIFEST.
open_form() {
  for _ in $(seq 100); do
    curl -fsS -o /dev/null "http://127.0.0.1:$WPORT/" 2>/dev/null && break
    sleep 0.1
  done
  PAGE=$(curl -fsS "http://127.0.0.1:$WPORT/")
  ACTION=$(sed -nE 's/.*action="([^"]+)".*/\1/p' <<<"$PAGE")
  STATE=${ACTION##*state=}
  MANIFEST=$(node -e '
    const html = require("node:fs").readFileSync(0, "utf8");
    const value = /name="manifest" value="([^"]*)"/.exec(html)[1];
    process.stdout.write(value.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n)));
  ' <<<"$PAGE")
}

# github_redirects CODE — GitHub sending the browser back with CODE.
github_redirects() {
  curl -fsS -o /dev/null "http://127.0.0.1:$WPORT/callback?code=$1&state=$STATE"
}

# create_app — the human's side of stage 1: start, create on GitHub, return.
create_app() {
  printf '\n' >&3 # banner
  open_form
  github_redirects "${1:-mock-code}"
  printf '\n' >&3 # "Press Enter when done"
}

# ── A first run, GitHub redirecting back to the callback server ──────────
start_mock happy
dir="$tmp/agent-happy"
start_wizard happy "$dir"
printf '\n' >&3
open_form

check "the page posts to GitHub's new-App form with a fresh state" \
  [ "$ACTION" = "https://github.test/settings/apps/new?state=$STATE" ]
check "the state is 32 hex characters" grep -qxE '[0-9a-f]{32}' <<<"$STATE"
check "the manifest names dbarjs-agent, private, homepage on dbarjs" \
  jq -e '.name == "dbarjs-agent" and .public == false and .url == "https://github.test/dbarjs"' <<<"$MANIFEST"
check "the manifest turns the webhook off and subscribes to no events" \
  jq -e '.hook_attributes.active == false and .default_events == []' <<<"$MANIFEST"
check "the manifest asks for exactly the decided permissions" \
  jq -e '.default_permissions == {contents: "write", pull_requests: "write", issues: "write", workflows: "write", metadata: "read"}' <<<"$MANIFEST"
check "the manifest redirects back to the callback server" \
  jq -e --arg u "http://localhost:$WPORT/callback" '.redirect_url == $u' <<<"$MANIFEST"
check "the callback server rejects a redirect from another run" \
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WPORT/callback?code=x&state=other")" = 400 ]

github_redirects mock-code
printf '\n\n\n\n\n\n' >&3
finish_wizard

check "the wizard finishes" [ "$STATUS" = 0 ]
check "the key is GitHub's, byte for byte" cmp -s "$dir/private-key.pem" "$tmp/happy.mock.log.pem"
check "the key is mode 600" [ "$(stat -c %a "$dir/private-key.pem")" = 600 ]
check "its folder is mode 700" [ "$(stat -c %a "$dir")" = 700 ]
check "app.env records the App ID" env_has "$dir" DBARJS_AGENT_APP_ID=4242
check "app.env records the slug" env_has "$dir" DBARJS_AGENT_SLUG=dbarjs-agent
check "app.env records the client ID" env_has "$dir" DBARJS_AGENT_CLIENT_ID=Iv23liMockClientId
check "app.env records the key path" env_has "$dir" "DBARJS_AGENT_KEY=$dir/private-key.pem"
check "app.env records the installation ID" env_has "$dir" DBARJS_AGENT_INSTALLATION_ID=777
check "app.env records the bot login" env_has "$dir" "DBARJS_AGENT_BOT_LOGIN=dbarjs-agent[bot]"
check "app.env records the bot user ID" env_has "$dir" DBARJS_AGENT_BOT_ID=999
check "no client or webhook secret is written" no_secrets "$dir"
check "no client or webhook secret is printed" no_secrets "$tmp/happy.out"
check "the manifest conversion is unauthenticated" \
  [ "$(requests happy '.path | startswith("/app-manifests/")')" = "$(requests happy '(.path | startswith("/app-manifests/")) and .auth == "none"')" ]
check "no request carries any other credential, the gh token included" \
  [ "$(requests happy '.auth == "other"')" = 0 ]
check "it asked to install, then saw the installation" \
  [ "$(requests happy '.path == "/repos/dbarjs/hero-synergy/installation" and .auth == "jwt"')" = 2 ]
check "it revokes the token it minted for the check" \
  [ "$(requests happy '.method == "DELETE" and .path == "/installation/token"')" = 1 ]
check "it prints the record for the ticket" contains "$tmp/happy.out" 'For "Create and install the dbarjs-agent App" (#164):'
check "the record names the installation" contains "$tmp/happy.out" "Installation:  777, on dbarjs/hero-synergy only"
check "it points at the next session" contains "$tmp/happy.out" "/wayfinder #159 #164"

# ── A re-run skips creating the App ──────────────────────────────────────
conversions_before=$(requests happy '.path | startswith("/app-manifests/")')
start_wizard rerun "$dir"
printf '\n\n\n\n\n' >&3
finish_wizard
check "a re-run finishes" [ "$STATUS" = 0 ]
check "a re-run says the App already exists" contains "$tmp/rerun.out" "Already created: dbarjs-agent (App ID 4242)"
check "a re-run creates nothing" \
  [ "$(requests happy '.path | startswith("/app-manifests/")')" = "$conversions_before" ]
check "a re-run starts no callback server" \
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$WPORT/" || true)" = 000 ]

# ── The redirect page doesn't load, so the address is pasted ─────────────
start_mock paste
dir="$tmp/agent-paste"
start_wizard paste "$dir"
printf '\n' >&3
open_form
printf 'http://localhost:%s/callback?code=mock-code&state=0000\n' "$WPORT" >&3
printf 'http://localhost:%s/callback?code=mock-code&state=%s\n' "$WPORT" "$STATE" >&3
printf '\n\n\n\n\n\n' >&3
finish_wizard
check "a pasted address from another run is refused" contains "$tmp/paste.out" "belongs to another run"
check "a pasted address from this run creates the App" env_has "$dir" DBARJS_AGENT_APP_ID=4242
check "the pasted run finishes" [ "$STATUS" = 0 ]

# ── Enter before GitHub has redirected ───────────────────────────────────
start_mock early
start_wizard early "$tmp/agent-early"
printf '\n' >&3
open_form
printf '\n' >&3
for _ in $(seq 50); do contains "$tmp/early.out" "hasn't sent the code back yet" && break; sleep 0.1; done
github_redirects mock-code
printf '\n\n\n\n\n\n' >&3
finish_wizard
check "Enter too early asks again" contains "$tmp/early.out" "hasn't sent the code back yet"
check "the early run still finishes" [ "$STATUS" = 0 ]

# ── Failures ─────────────────────────────────────────────────────────────
# expect_failure MOCK MESSAGE [VAR=VALUE...] — run against a mock and expect
# the wizard to stop with MESSAGE.
expect_failure() {
  local mock="$1" message="$2"
  start_mock "$mock" "${@:3}"
  start_wizard "$mock" "$tmp/agent-$mock"
  create_app
  printf '\n\n\n\n\n\n' >&3
  finish_wizard
  check "$mock: the wizard stops" [ "$STATUS" = 1 ]
  check "$mock: it says why" contains "$tmp/$mock.out" "$message"
}

expect_failure all-repos "It's installed on all repositories." MOCK_SELECTION=all
check "all-repos: the key is kept for the re-run" [ -s "$tmp/agent-all-repos/private-key.pem" ]

expect_failure extra-repo "It reaches dbarjs/hero-synergy, dbarjs/other." \
  MOCK_REPOS=dbarjs/hero-synergy,dbarjs/other
check "extra-repo: the check's token is still revoked" \
  [ "$(requests extra-repo '.method == "DELETE" and .path == "/installation/token"')" = 1 ]

expect_failure admin "It holds {\"administration\":\"write\"," \
  'MOCK_PERMISSIONS={"administration":"write","contents":"write","issues":"write","metadata":"read","pull_requests":"write","workflows":"write"}'

expect_failure public "The App is public." MOCK_PUBLIC=1

name=expired
start_mock expired
start_wizard expired "$tmp/agent-expired"
create_app expired-code
finish_wizard
check "expired: the wizard stops" [ "$STATUS" = 1 ]
check "expired: it says how to recover" contains "$tmp/expired.out" "GitHub didn't hand over the new App (HTTP 404)."
check "expired: no key is written" [ ! -e "$tmp/agent-expired/private-key.pem" ]

name=no-tty
STATUS=0
bash "$here/dbarjs-agent-app.sh" </dev/null >"$tmp/no-tty.out" 2>&1 || STATUS=$?
check "without a terminal it refuses to start" [ "$STATUS" = 1 ]
check "without a terminal it says why" contains "$tmp/no-tty.out" "Run this from a terminal"

printf '\n%s checks passed\n' "$passed"
