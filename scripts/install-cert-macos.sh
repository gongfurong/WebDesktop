#!/usr/bin/env bash
set -eu

CERT_NAME="Orbit Dash Local Root CA"
KEYCHAIN="/Library/Keychains/System.keychain"
DEFAULT_PROJECT_ROOT="$(cd "$(dirname "$0")/../examples/orbit-dash-pwa" && pwd)"
PROJECT_ROOT="$DEFAULT_PROJECT_ROOT"
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/install-cert-macos.sh install [--project-root <path>] [--dry-run]
  ./scripts/install-cert-macos.sh remove [--project-root <path>] [--dry-run]
  ./scripts/install-cert-macos.sh status [--project-root <path>] [--dry-run]
  ./scripts/install-cert-macos.sh clean [--project-root <path>] [--dry-run]
  ./scripts/install-cert-macos.sh reset [--project-root <path>] [--dry-run]

Notes:
- Uses the macOS System keychain so browsers can trust the root CA.
- install/remove usually require sudo privileges.
EOF
}

set_project_paths() {
  PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
  CERT_PATH="${PROJECT_ROOT}/certs/root-ca-cert.cer"
  GENERATED_FILES="root-ca-key.pem root-ca-cert.pem root-ca-cert.cer root-ca-cert.srl local-key.pem local-cert.pem local-cert.cer local-cert.csr openssl-root.cnf openssl-local.cnf openssl-local.ext"
}

run_step() {
  DESCRIPTION="$1"
  shift
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "$DESCRIPTION"
    return
  fi
  "$@"
}

require_cert() {
  if [ ! -f "$CERT_PATH" ]; then
    printf 'Certificate not found: %s\n' "$CERT_PATH" >&2
    printf 'Generate certificates first with powershell -ExecutionPolicy Bypass -File .\\scripts\\generate-cert.ps1\n' >&2
    exit 1
  fi
}

install_cert() {
  require_cert
  run_step "Install root certificate into macOS System keychain" sudo security add-trusted-cert -d -r trustRoot -k "$KEYCHAIN" "$CERT_PATH"
  printf 'Installed %s into %s\n' "$CERT_NAME" "$KEYCHAIN"
  printf 'Restart Chrome / Edge / Safari if they were already open.\n'
}

remove_cert() {
  run_step "Remove root certificate from macOS System keychain" sudo security delete-certificate -c "$CERT_NAME" "$KEYCHAIN"
  printf 'Removed %s from %s\n' "$CERT_NAME" "$KEYCHAIN"
}

status_cert() {
  if security find-certificate -c "$CERT_NAME" "$KEYCHAIN" >/dev/null 2>&1; then
    printf 'Installed: %s\n' "$CERT_NAME"
  else
    printf 'Not installed: %s\n' "$CERT_NAME"
    exit 1
  fi
}

clean_cert() {
  for file in $GENERATED_FILES; do
    target="${PROJECT_ROOT}/certs/${file}"
    if [ -f "$target" ]; then
      run_step "Delete generated file $target" rm -f "$target"
    fi
  done
  printf 'Cleaned generated certificate artifacts in %s\n' "${PROJECT_ROOT}/certs"
}

ACTION="${1:-}"
shift || true

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project-root)
      PROJECT_ROOT="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

set_project_paths

case "$ACTION" in
  install)
    install_cert
    ;;
  remove)
    remove_cert
    ;;
  status)
    status_cert
    ;;
  clean)
    clean_cert
    ;;
  reset)
    remove_cert
    clean_cert
    ;;
  *)
    usage
    exit 1
    ;;
esac
