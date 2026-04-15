#!/usr/bin/env bash
set -eu

CERT_NAME="Orbit Dash Local Root CA"
INSTALL_BASENAME="orbit-dash-local-root-ca.crt"
DEFAULT_PROJECT_ROOT="$(cd "$(dirname "$0")/../examples/orbit-dash-pwa" && pwd)"
PROJECT_ROOT="$DEFAULT_PROJECT_ROOT"
WITH_NSS=0
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/install-cert-linux.sh install [--project-root <path>] [--with-nss] [--dry-run]
  ./scripts/install-cert-linux.sh remove [--project-root <path>] [--with-nss] [--dry-run]
  ./scripts/install-cert-linux.sh status [--project-root <path>] [--with-nss] [--dry-run]
  ./scripts/install-cert-linux.sh clean [--project-root <path>] [--dry-run]
  ./scripts/install-cert-linux.sh reset [--project-root <path>] [--with-nss] [--dry-run]

Notes:
- Supports common distro trust stores: Debian/Ubuntu, RHEL/Fedora/Rocky/CentOS,
  Arch/Manjaro, openSUSE/SLES.
- --with-nss also imports/removes the root CA in $HOME/.pki/nssdb when certutil is available.
- Some Linux browser builds may still behave differently; if so, prefer a real HTTPS domain/tunnel.
EOF
}

set_project_paths() {
  PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
  CERT_DER_PATH="${PROJECT_ROOT}/certs/root-ca-cert.cer"
  WORK_PATH="${PROJECT_ROOT}/certs/${INSTALL_BASENAME}"
  GENERATED_FILES="root-ca-key.pem root-ca-cert.pem root-ca-cert.cer root-ca-cert.srl local-key.pem local-cert.pem local-cert.cer local-cert.csr openssl-root.cnf openssl-local.cnf openssl-local.ext ${INSTALL_BASENAME}"
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

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Required tool not found: %s\n' "$1" >&2
    exit 1
  fi
}

require_cert() {
  if [ ! -f "$CERT_DER_PATH" ]; then
    printf 'Certificate not found: %s\n' "$CERT_DER_PATH" >&2
    printf 'Generate certificates first with powershell -ExecutionPolicy Bypass -File .\\scripts\\generate-cert.ps1\n' >&2
    exit 1
  fi
}

prepare_pem() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] Convert root certificate to Linux trust-store format\n'
    return
  fi
  require_tool openssl
  require_cert
  openssl x509 -inform der -in "$CERT_DER_PATH" -out "$WORK_PATH"
}

detect_store() {
  if [ -f /etc/debian_version ]; then
    STORE_PATH="/usr/local/share/ca-certificates/${INSTALL_BASENAME}"
    UPDATE_CMD="update-ca-certificates"
    REMOVE_CMD="update-ca-certificates --fresh"
    return
  fi

  if [ -f /etc/redhat-release ]; then
    STORE_PATH="/etc/pki/ca-trust/source/anchors/${INSTALL_BASENAME}"
    UPDATE_CMD="update-ca-trust extract"
    REMOVE_CMD="update-ca-trust extract"
    return
  fi

  if [ -f /etc/arch-release ]; then
    STORE_PATH="/etc/ca-certificates/trust-source/anchors/${INSTALL_BASENAME}"
    UPDATE_CMD="trust extract-compat"
    REMOVE_CMD="trust extract-compat"
    return
  fi

  if [ -f /etc/SuSE-release ] || [ -f /etc/os-release ] && grep -qi 'suse' /etc/os-release; then
    STORE_PATH="/etc/pki/trust/anchors/${INSTALL_BASENAME}"
    UPDATE_CMD="update-ca-certificates"
    REMOVE_CMD="update-ca-certificates"
    return
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    STORE_PATH="<linux-system-trust-store>/${INSTALL_BASENAME}"
    UPDATE_CMD="<refresh-linux-trust-store>"
    REMOVE_CMD="<refresh-linux-trust-store-after-removal>"
    return
  fi

  printf 'Unsupported Linux distribution. Import %s into your system trust store manually.\n' "$WORK_PATH" >&2
  exit 1
}

run_update() {
  sh -c "$1"
}

ensure_nss_db() {
  mkdir -p "$HOME/.pki/nssdb"
  if [ ! -f "$HOME/.pki/nssdb/cert9.db" ] && [ ! -f "$HOME/.pki/nssdb/cert8.db" ]; then
    certutil -N -d sql:"$HOME/.pki/nssdb" --empty-password
  fi
}

install_nss() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] Import root certificate into NSS DB\n'
    printf 'Imported %s into %s\n' "$CERT_NAME" "$HOME/.pki/nssdb"
    return
  fi
  require_tool certutil
  ensure_nss_db
  run_step "Import root certificate into NSS DB" certutil -A -d sql:"$HOME/.pki/nssdb" -n "$CERT_NAME" -t "C,," -i "$WORK_PATH"
  printf 'Imported %s into %s\n' "$CERT_NAME" "$HOME/.pki/nssdb"
}

remove_nss() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] Remove root certificate from NSS DB\n'
    printf 'Removed %s from %s\n' "$CERT_NAME" "$HOME/.pki/nssdb"
    return
  fi
  require_tool certutil
  if [ -d "$HOME/.pki/nssdb" ]; then
    certutil -D -d sql:"$HOME/.pki/nssdb" -n "$CERT_NAME" >/dev/null 2>&1 || true
    printf 'Removed %s from %s\n' "$CERT_NAME" "$HOME/.pki/nssdb"
  fi
}

status_nss() {
  require_tool certutil
  if [ -d "$HOME/.pki/nssdb" ] && certutil -L -d sql:"$HOME/.pki/nssdb" -n "$CERT_NAME" >/dev/null 2>&1; then
    printf 'NSS DB: installed\n'
  else
    printf 'NSS DB: not installed\n'
  fi
}

install_cert() {
  prepare_pem
  detect_store
  run_step "Create Linux system trust store directory" sudo mkdir -p "$(dirname "$STORE_PATH")"
  run_step "Copy root certificate into Linux trust store" sudo cp "$WORK_PATH" "$STORE_PATH"
  run_step "Refresh Linux trust store" sudo sh -c "$UPDATE_CMD"
  printf 'Installed %s into %s\n' "$CERT_NAME" "$STORE_PATH"
  if [ "$WITH_NSS" -eq 1 ]; then
    install_nss
  fi
  printf 'Restart your browser after trust store updates.\n'
}

remove_cert() {
  detect_store
  run_step "Remove root certificate from Linux trust store" sudo rm -f "$STORE_PATH"
  run_step "Refresh Linux trust store after removal" sudo sh -c "$REMOVE_CMD"
  printf 'Removed %s from %s\n' "$CERT_NAME" "$STORE_PATH"
  if [ "$WITH_NSS" -eq 1 ]; then
    remove_nss
  fi
}

status_cert() {
  detect_store
  if [ -f "$STORE_PATH" ]; then
    printf 'System store: installed at %s\n' "$STORE_PATH"
  else
    printf 'System store: not installed\n'
  fi
  if [ "$WITH_NSS" -eq 1 ]; then
    status_nss
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
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      PROJECT_ROOT="$2"
      shift 2
      ;;
    --with-nss)
      WITH_NSS=1
      shift
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
