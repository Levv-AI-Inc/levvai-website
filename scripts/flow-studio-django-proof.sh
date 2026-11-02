#!/usr/bin/env bash
# Proves the Django store end to end on the LOCAL Docker Postgres (127.0.0.1:5433): next start with
# FLOW_STUDIO_STORE=django against a local Django, through real sessions, CSRF and the store token.
#
# Empties Flow Studio's tables in the `local` and `fsproof` tenant schemas of that local database, and leaves `local`
# freshly seeded at the end.
# Never reads a .env. The database URL below is the only one it uses.
set -euo pipefail

WEBSITE="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="${FLOW_STUDIO_BACKEND_DIR:-$WEBSITE/../flow-studio-backend}"
PY="${FLOW_STUDIO_PYTHON:-$WEBSITE/../levvai-backend/.venv/bin/python}"
DJANGO_PORT=8011
NEXT_PORT=3311

export DATABASE_URL=postgresql://levvai:levvai@127.0.0.1:5433/levvai_local
export DJANGO_SECRET_KEY=local-development-only-secret-key
export DJANGO_DEBUG=true
export DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,fsproof.localhost
export DATABASE_CONN_MAX_AGE=0
export FLOW_STUDIO_STORE_TOKEN=local-proof-store-token
export LOCAL_ADMIN_PASSWORD=Local-Proof-Password-1!
export PYTHONWARNINGS=ignore

BACKEND_URL="http://127.0.0.1:$DJANGO_PORT"
LOGS="$(mktemp -d)"
echo "Logs: $LOGS"
PIDS=()
cleanup() { for pid in "${PIDS[@]:-}"; do kill "$pid" 2>/dev/null || true; done; }
trap cleanup EXIT

wait_for() { for _ in $(seq 1 120); do curl -s -o /dev/null "$1" && return 0; sleep 0.5; done; echo "Timed out waiting for $1"; exit 1; }

empty_tables() {
  (cd "$BACKEND" && "$PY" manage.py shell <<'PY'
from django.db import connection
from django_tenants.utils import schema_context
from apps.flowstudio.models import COLLECTIONS

assert connection.settings_dict["HOST"] == "127.0.0.1" and str(connection.settings_dict["PORT"]) == "5433"
tables = ", ".join(model._meta.db_table for model in COLLECTIONS.values())
for schema in ("local", "fsproof"):
    with schema_context(schema), connection.cursor() as cursor:
        cursor.execute(f"TRUNCATE {tables} CASCADE")
PY
  )
}

cd "$BACKEND"
"$PY" manage.py migrate_schemas --shared -v 0
"$PY" manage.py migrate_schemas --tenant -v 0
"$PY" manage.py bootstrap_local_dev >/dev/null
"$PY" manage.py shell <<'PY'
from django.db import connection
from apps.accounts.models import Membership, User
from apps.tenants.models import Domain, Tenant

assert connection.settings_dict["HOST"] == "127.0.0.1" and str(connection.settings_dict["PORT"]) == "5433"

tenant, created = Tenant.objects.get_or_create(schema_name="fsproof", defaults={"name": "Flow Studio proof"})
Domain.objects.get_or_create(domain="fsproof.localhost", defaults={"tenant": tenant, "is_primary": True})

local = Tenant.objects.get(schema_name="local")
second, _ = User.objects.get_or_create(username="second-admin@local.levvai.test", defaults={"email": "second-admin@local.levvai.test", "first_name": "Second", "last_name": "Admin"})
second.set_password("Local-Proof-Password-1!")
second.save()
Membership.objects.update_or_create(user=second, tenant=local, defaults={"role": Membership.ROLE_ADMIN, "status": Membership.STATUS_ACTIVE, "is_active": True})

# A person from the seeded people, with no admin role: the assignee who reaches /inbox and nothing else.
raj, _ = User.objects.get_or_create(username="raj.patel@local.levvai.test", defaults={"email": "raj.patel@local.levvai.test", "first_name": "Raj", "last_name": "Patel"})
raj.set_password("Local-Proof-Password-1!")
raj.save()
Membership.objects.update_or_create(user=raj, tenant=local, defaults={"role": Membership.ROLE_VIEWER, "status": Membership.STATUS_ACTIVE, "is_active": True})

# Two members nobody has linked to a person: what a user who renames themselves is, and what linking is proved on.
for email, role in (("mallory@local.levvai.test", Membership.ROLE_VIEWER), ("ivy@local.levvai.test", Membership.ROLE_VIEWER)):
    member, _ = User.objects.get_or_create(username=email, defaults={"email": email})
    member.set_password("Local-Proof-Password-1!")
    member.save()
    Membership.objects.update_or_create(user=member, tenant=local, defaults={"role": role, "status": Membership.STATUS_ACTIVE, "is_active": True})

connection.set_schema_to_public()
PY
empty_tables

"$PY" manage.py runserver --noreload "127.0.0.1:$DJANGO_PORT" >"$LOGS/django.log" 2>&1 &
PIDS+=($!)
wait_for "$BACKEND_URL/healthz"

cd "$WEBSITE"
echo "== seed guards"
if FLOW_STUDIO_BACKEND_URL=https://example.com npm run -s seed:flow-studio; then echo "SEED DID NOT REFUSE A REMOTE BACKEND"; exit 1; fi

echo "== seed the local tenant, twice"
FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" npm run -s seed:flow-studio
FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" npm run -s seed:flow-studio

echo "== store contract against Django"
FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" FLOW_STUDIO_CONTRACT_TENANT_HOST=fsproof.localhost npx vitest run --config vitest.django.config.ts tests/django/store.test.ts

if [ -z "${FLOW_STUDIO_PROOF_SKIP_BUILD:-}" ]; then
  # LOCAL_BACKEND_URL is read at build time, for the rewrites that take the browser's /api/session and login to Django.
  LOCAL_BACKEND_URL="$BACKEND_URL" NEXT_TELEMETRY_DISABLED=1 npm run -s build >"$LOGS/build.log" 2>&1 || { tail -30 "$LOGS/build.log"; exit 1; }
fi

export LEVV_SERVICE_TOKEN=local-proof-service-token LEVV_CRON_SECRET=local-proof-cron-secret

# LEVV_MOCK_AUTOCOMPLETE=1 on purpose: a production process must ignore it, and the runtime proof checks that it did.
echo "== next start, FLOW_STUDIO_STORE=django"
FLOW_STUDIO_STORE=django FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" LEVV_FIXED_NOW=2026-10-20T09:00:00Z LEVV_MOCK_AUTOCOMPLETE=1 \
  LOCAL_BACKEND_URL='' OPENAI_API_KEY='' npx next start -p "$NEXT_PORT" >"$LOGS/next.log" 2>&1 &
NEXT_PID=$!
PIDS+=($NEXT_PID)
wait_for "http://localhost:$NEXT_PORT/auth/login"

FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" NEXT_URL="http://localhost:$NEXT_PORT" \
  ADMIN_EMAIL=admin@local.levvai.test SECOND_EMAIL=second-admin@local.levvai.test RAJ_EMAIL=raj.patel@local.levvai.test PROOF_PASSWORD="$LOCAL_ADMIN_PASSWORD" \
  npx vite-node --config vitest.config.ts scripts/flow-studio-django-proof.ts

echo "== /admin/workflows in a browser, on Django: edit, reload, conflict, Test, Nova, send and approve"
export NEXT_URL="http://localhost:$NEXT_PORT" ADMIN_EMAIL=admin@local.levvai.test SECOND_EMAIL=second-admin@local.levvai.test RAJ_EMAIL=raj.patel@local.levvai.test PROOF_PASSWORD="$LOCAL_ADMIN_PASSWORD" FLOW_STUDIO_BACKEND_URL="$BACKEND_URL"
npx playwright test --config playwright.django.config.ts --grep-invert @later

kill "$NEXT_PID" 2>/dev/null || true
wait "$NEXT_PID" 2>/dev/null || true

echo "== next start a day later: the tick, called with the cron secret"
FLOW_STUDIO_STORE=django FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" LEVV_FIXED_NOW=2026-10-21T09:05:00Z \
  LOCAL_BACKEND_URL='' OPENAI_API_KEY='' npx next start -p "$NEXT_PORT" >"$LOGS/next-later.log" 2>&1 &
NEXT_PID=$!
PIDS+=($NEXT_PID)
wait_for "http://localhost:$NEXT_PORT/auth/login"
npx playwright test --config playwright.django.config.ts --grep @later

kill "$NEXT_PID" 2>/dev/null || true
wait "$NEXT_PID" 2>/dev/null || true

echo "== next start, LEVV_E2E=1 and the middleware rewrite"
LEVV_E2E=1 FLOW_STUDIO_STORE=memory LEVV_FIXED_NOW=2026-10-20T09:00:00Z LOCAL_BACKEND_URL='' \
  npx next start -p "$NEXT_PORT" >"$LOGS/e2e.log" 2>&1 &
NEXT_PID=$!
PIDS+=($NEXT_PID)
wait_for "http://localhost:$NEXT_PORT/auth/login"
test "$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:$NEXT_PORT/api/test/reset")" = 204
JAR="$(mktemp)"
test "$(curl -s -c "$JAR" -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"user":"Samira Khan"}' "http://localhost:$NEXT_PORT/api/test/sign-in")" = 204
curl -s -b "$JAR" "http://localhost:$NEXT_PORT/api/session" | grep -q '"first_name":"Samira"'
test "$(curl -s -b "$JAR" "http://localhost:$NEXT_PORT/api/flow-studio/workflows" | grep -o '"id"' | wc -l | tr -d ' ')" = 15
rm -f "$JAR"
echo "ok  LEVV_E2E=1: reset 204, sign-in 204, /api/session answered by the rewrite, 15 workflows from memory"
kill "$NEXT_PID" 2>/dev/null || true
wait "$NEXT_PID" 2>/dev/null || true

echo "== next start, no LEVV_E2E: test routes are gone"
FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" LOCAL_BACKEND_URL='' npx next start -p "$NEXT_PORT" >"$LOGS/prod.log" 2>&1 &
NEXT_PID=$!
PIDS+=($NEXT_PID)
wait_for "http://localhost:$NEXT_PORT/auth/login"
for route in reset sign-in clock; do
  test "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: application/json' -d '{"user":"Flow Admin"}' "http://localhost:$NEXT_PORT/api/test/$route")" = 404
done
test "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:$NEXT_PORT/api/test/session")" = 404
echo "ok  without LEVV_E2E: reset, sign-in, clock and session all answer 404"

echo "== the runtime's races against Django and Postgres"
FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" FLOW_STUDIO_CONTRACT_TENANT_HOST=fsproof.localhost npx vitest run --config vitest.django.config.ts tests/django/runtime-races.test.ts
# Last, because they seed the proof tenant, and the proof above checks it holds no workflows.

echo "== leaving the local tenant freshly seeded"
empty_tables
FLOW_STUDIO_BACKEND_URL="$BACKEND_URL" npm run -s seed:flow-studio
echo "== proof passed"
