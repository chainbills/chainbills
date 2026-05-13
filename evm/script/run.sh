#!/usr/bin/env bash
# =============================================================================
# run.sh — Chainbills EVM script runner
#
# Usage:
#   ./script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]
#
# Examples:
#   ./script/run.sh arc  SetupCCTPOnly
#   ./script/run.sh sepolia SetupWormholeAndCircle
#
#   ./script/run.sh sepolia RegisterForeignChain  arc     # Sepolia learns about Arc
#   ./script/run.sh arc    RegisterForeignChain  sepolia  # Arc learns about Sepolia
#
#   ./script/run.sh sepolia RegisterMatchingToken arc     # "Arc USDC → my Sepolia USDC"
#   ./script/run.sh arc    RegisterMatchingToken sepolia  # "Sepolia USDC → my Arc USDC"
#
#   ./script/run.sh megaeth ComputeCbChainId              # no broadcast, no key needed
#   ./script/run.sh sepolia RegisterForeignChain arc --dry-run
#
# Adding a new chain?  Run these for each existing chain <c>:
#   ./script/run.sh <c>        RegisterForeignChain  <new>
#   ./script/run.sh <c>        RegisterMatchingToken <new>
#   ./script/run.sh <new>      RegisterForeignChain  <c>
#   ./script/run.sh <new>      RegisterMatchingToken <c>
#
# Arguments:
#   chain        — source chain: sepolia | arc | megaeth | ...
#   ScriptName   — Foundry script contract name (without .s.sol)
#   target-chain — (optional) foreign chain env to derive FOREIGN_* vars from
#   --dry-run    — simulate only, skip --broadcast
#
# The script loads script/env/<chain>.env (committed, addresses pre-filled).
# Put your PRIVATE_KEY in script/env/<chain>.env.local (gitignored).
# =============================================================================

set -euo pipefail

CHAIN="${1:-}"
SCRIPT_NAME="${2:-}"
# Third arg can be a target chain name or --dry-run
ARG3="${3:-}"
ARG4="${4:-}"

if [[ "$ARG3" == "--dry-run" ]]; then
  TARGET_CHAIN=""
  DRY_RUN="--dry-run"
else
  TARGET_CHAIN="$ARG3"
  DRY_RUN="$ARG4"
fi

if [[ -z "$CHAIN" || -z "$SCRIPT_NAME" ]]; then
  echo "Usage: $0 <chain> <ScriptName> [<target-chain>] [--dry-run]"
  echo "  chain: sepolia | arc | megaeth"
  echo "  ScriptName: e.g. SetupWormholeAndCircle, RegisterForeignChain, ..."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/env/${CHAIN}.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE"
  echo "Available chains: $(ls "${SCRIPT_DIR}/env/" | sed 's/\.env//' | grep -v '\.local' | tr '\n' ' ')"
  exit 1
fi

# --- Load source chain env -----------------------------------------------
set -o allexport
# shellcheck disable=SC2046
eval $(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$' | sed 's/\r//')
set +o allexport

# Load optional .env.local override (gitignored — put your PRIVATE_KEY here)
LOCAL_ENV_FILE="${ENV_FILE%.env}.env.local"
if [[ -f "$LOCAL_ENV_FILE" ]]; then
  set -o allexport
  # shellcheck disable=SC2046
  eval $(grep -v '^\s*#' "$LOCAL_ENV_FILE" | grep -v '^\s*$' | sed 's/\r//')
  set +o allexport
  echo ">>> Loaded local overrides: $LOCAL_ENV_FILE"
fi

# --- Derive FOREIGN_* from target chain env (if provided) -----------------
if [[ -n "$TARGET_CHAIN" ]]; then
  TARGET_ENV_FILE="${SCRIPT_DIR}/env/${TARGET_CHAIN}.env"
  if [[ ! -f "$TARGET_ENV_FILE" ]]; then
    echo "Error: target chain env file not found: $TARGET_ENV_FILE"
    exit 1
  fi

  # Load target .env.local too if present (for CB_ADDRESS after deploy)
  TARGET_LOCAL="${TARGET_ENV_FILE%.env}.env.local"
  TARGET_CONTENT=$(grep -v '^\s*#' "$TARGET_ENV_FILE" | grep -v '^\s*$' | sed 's/\r//')
  if [[ -f "$TARGET_LOCAL" ]]; then
    TARGET_CONTENT="${TARGET_CONTENT}"$'\n'"$(grep -v '^\s*#' "$TARGET_LOCAL" | grep -v '^\s*$' | sed 's/\r//')"
  fi

  _get() { echo "$TARGET_CONTENT" | grep "^${1}=" | tail -1 | cut -d'=' -f2-; }

  export FOREIGN_CB_CHAIN_ID=$(_get CB_CHAIN_ID)
  export FOREIGN_CIRCLE_DOMAIN=$(_get CIRCLE_DOMAIN)
  export FOREIGN_WORMHOLE_ID=$(_get WORMHOLE_CHAIN_ID)
  export FOREIGN_CB_ADDRESS=$(_get CB_ADDRESS)

  # Convert target's USDC address to bytes32 (left-pad to 32 bytes = 64 hex chars)
  _target_usdc=$(_get USDC_ADDRESS)
  if [[ -n "$_target_usdc" ]]; then
    _addr="${_target_usdc#0x}"
    export FOREIGN_TOKEN="0x000000000000000000000000${_addr}"
  fi

  # LOCAL_TOKEN = this chain's USDC
  export LOCAL_TOKEN="${USDC_ADDRESS:-}"

  echo ">>> Target chain : $TARGET_CHAIN"
  echo ">>> FOREIGN_CB_CHAIN_ID  : ${FOREIGN_CB_CHAIN_ID:-not set}"
  echo ">>> FOREIGN_CIRCLE_DOMAIN: ${FOREIGN_CIRCLE_DOMAIN:-not set}"
  echo ">>> FOREIGN_WORMHOLE_ID  : ${FOREIGN_WORMHOLE_ID:-not set}"
  echo ">>> FOREIGN_CB_ADDRESS   : ${FOREIGN_CB_ADDRESS:-not set}"
  echo ">>> FOREIGN_TOKEN        : ${FOREIGN_TOKEN:-not set}"
  echo ">>> LOCAL_TOKEN          : ${LOCAL_TOKEN:-not set}"
fi

# --- Validate ---------------------------------------------------------------
SCRIPT_FILE="script/${SCRIPT_NAME}.s.sol"

if [[ ! -f "$SCRIPT_FILE" ]]; then
  echo "Error: script not found: $SCRIPT_FILE"
  exit 1
fi

if [[ "$SCRIPT_NAME" != "ComputeCbChainId" && -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is not set."
  echo "  Create script/env/${CHAIN}.env.local with: PRIVATE_KEY=0x..."
  exit 1
fi

# --- Broadcast mode ---------------------------------------------------------
if [[ "$DRY_RUN" == "--dry-run" || "$SCRIPT_NAME" == "ComputeCbChainId" ]]; then
  BROADCAST_FLAG=""
  echo ">>> Dry run (no broadcast): $SCRIPT_NAME on $CHAIN"
else
  BROADCAST_FLAG="--broadcast"
  echo ">>> Broadcasting: $SCRIPT_NAME on $CHAIN"
fi

echo ">>> Env: $ENV_FILE"
echo ">>> RPC: ${RPC_URL:-not set}"
echo ""

forge script "$SCRIPT_FILE" \
  --rpc-url "${RPC_URL}" \
  $BROADCAST_FLAG \
  -vvvv
