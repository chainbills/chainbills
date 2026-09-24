#!/usr/bin/env bash
# =============================================================================
# run.sh — Chainbills EVM script runner
#
# Usage:
#   ./script/run.sh <chain> <ScriptName> [<target-chain>] [--dry-run]
#
# Examples:
#   ./script/run.sh arcmainnet DeployChainbills
#   ./script/run.sh arcmainnet PredictAddresses
#   ./script/run.sh arcmainnet SetupCctp
#
#   ./script/run.sh sepolia RegisterForeignChain arcmainnet   # Sepolia learns about Arc
#   ./script/run.sh arcmainnet RegisterForeignChain sepolia   # Arc learns about Sepolia
#
#   ./script/run.sh sepolia RegisterMatchingToken arcmainnet  # "Arc USDC → my Sepolia USDC"
#   ./script/run.sh arcmainnet RegisterMatchingToken sepolia  # "Sepolia USDC → my Arc USDC"
#
#   ./script/run.sh arcmainnet ComputeCbChainId                # no broadcast, no key needed
#   ./script/run.sh sepolia RegisterForeignChain arcmainnet --dry-run
#
# Adding a new chain?  Run these for each existing chain <c>:
#   ./script/run.sh <c>        RegisterForeignChain  <new>
#   ./script/run.sh <c>        RegisterMatchingToken <new>
#   ./script/run.sh <new>      RegisterForeignChain  <c>
#   ./script/run.sh <new>      RegisterMatchingToken <c>
#
# Arguments:
#   chain        — source chain: matches script/env/<chain>.env
#   ScriptName   — Foundry script contract name (without .s.sol), from script/ or script/admin/
#   target-chain — (optional) foreign chain env to derive FOREIGN_* vars from
#   --dry-run    — simulate only, skip --broadcast
#
# The script loads script/env/<chain>.env (committed, addresses pre-filled).
# Put your PRIVATE_KEY in script/env/<chain>.env.local (gitignored).
#
# DIAMOND is set automatically from deploys/<chain>.json when present, unless already set by the env files.
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

export TARGET_CHAIN="$TARGET_CHAIN"

if [[ -z "$CHAIN" || -z "$SCRIPT_NAME" ]]; then
  echo "Usage: $0 <chain> <ScriptName> [<target-chain>] [--dry-run]"
  echo "  chain: matches a script/env/<chain>.env file"
  echo "  ScriptName: e.g. DeployChainbills, RegisterForeignChain, SetupCctp, ..."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVM_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/env/${CHAIN}.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: env file not found: $ENV_FILE"
  echo "Available chains: $(ls "${SCRIPT_DIR}/env/" | sed 's/\.env$//' | grep -v '\.local' | tr '\n' ' ')"
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

export CHAIN_NAME="$CHAIN"

# --- Extract a top-level string field from a small, flat, self-generated JSON file --------------------------------
_json_field() {
  local file="$1" field="$2"
  grep -o "\"${field}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$file" | head -1 | sed -E 's/.*:[[:space:]]*"([^"]*)"/\1/'
}

# --- Default DIAMOND from deploys/<chain>.json, unless already set --------------------------------------------
DEPLOY_RECORD="${EVM_DIR}/deploys/${CHAIN}.json"
if [[ -z "${DIAMOND:-}" && -f "$DEPLOY_RECORD" ]]; then
  export DIAMOND="$(_json_field "$DEPLOY_RECORD" diamond)"
fi

# --- Derive FOREIGN_* from target chain env and its deploy record (if provided) -----------------------------------
if [[ -n "$TARGET_CHAIN" ]]; then
  TARGET_ENV_FILE="${SCRIPT_DIR}/env/${TARGET_CHAIN}.env"
  if [[ ! -f "$TARGET_ENV_FILE" ]]; then
    echo "Error: target chain env file not found: $TARGET_ENV_FILE"
    exit 1
  fi

  TARGET_LOCAL="${TARGET_ENV_FILE%.env}.env.local"
  TARGET_CONTENT=$(grep -v '^\s*#' "$TARGET_ENV_FILE" | grep -v '^\s*$' | sed 's/\r//')
  if [[ -f "$TARGET_LOCAL" ]]; then
    TARGET_CONTENT="${TARGET_CONTENT}"$'\n'"$(grep -v '^\s*#' "$TARGET_LOCAL" | grep -v '^\s*$' | sed 's/\r//')"
  fi

  _get() { echo "$TARGET_CONTENT" | grep "^${1}=" | tail -1 | cut -d'=' -f2-; }

  export FOREIGN_CB_CHAIN_ID=$(_get CB_CHAIN_ID)
  _foreign_circle_domain=$(_get CIRCLE_DOMAIN)
  [[ -n "$_foreign_circle_domain" ]] && export FOREIGN_CIRCLE_DOMAIN="$_foreign_circle_domain"
  _foreign_wormhole_id=$(_get WORMHOLE_CHAIN_ID)
  [[ -n "$_foreign_wormhole_id" ]] && export FOREIGN_WORMHOLE_CHAIN_ID="$_foreign_wormhole_id"

  # Convert target's USDC address to bytes32 (left-pad to 32 bytes = 64 hex chars)
  _target_usdc=$(_get USDC_ADDRESS)
  if [[ -n "$_target_usdc" ]]; then
    _addr="${_target_usdc#0x}"
    export FOREIGN_TOKEN="0x000000000000000000000000${_addr}"
  fi

  # LOCAL_TOKEN = this chain's USDC
  [[ -n "${USDC_ADDRESS:-}" ]] && export LOCAL_TOKEN="${USDC_ADDRESS}"

  echo ">>> Target chain        : $TARGET_CHAIN"
  echo ">>> FOREIGN_CB_CHAIN_ID  : ${FOREIGN_CB_CHAIN_ID:-not set}"
  echo ">>> FOREIGN_CIRCLE_DOMAIN: ${FOREIGN_CIRCLE_DOMAIN:-not set}"
  echo ">>> FOREIGN_WORMHOLE_CHAIN_ID: ${FOREIGN_WORMHOLE_CHAIN_ID:-not set}"
  echo ">>> FOREIGN_TOKEN        : ${FOREIGN_TOKEN:-not set}"
  echo ">>> LOCAL_TOKEN          : ${LOCAL_TOKEN:-not set}"
fi

# --- Locate the script file (deploy/upgrade/predict at script/, admin ops at script/admin/) -----------------------
if [[ -f "${EVM_DIR}/script/${SCRIPT_NAME}.s.sol" ]]; then
  SCRIPT_FILE="script/${SCRIPT_NAME}.s.sol"
elif [[ -f "${EVM_DIR}/script/admin/${SCRIPT_NAME}.s.sol" ]]; then
  SCRIPT_FILE="script/admin/${SCRIPT_NAME}.s.sol"
else
  echo "Error: script not found: script/${SCRIPT_NAME}.s.sol or script/admin/${SCRIPT_NAME}.s.sol"
  exit 1
fi

if [[ "$SCRIPT_NAME" != "ComputeCbChainId" && "$SCRIPT_NAME" != "PredictAddresses" && -z "${PRIVATE_KEY:-}" ]]; then
  echo "Error: PRIVATE_KEY is not set."
  echo "  Create script/env/${CHAIN}.env.local with: PRIVATE_KEY=0x..."
  exit 1
fi

# Compulsory for DeployChainbills
if [[ "$SCRIPT_NAME" == "DeployChainbills" ]]; then
  if [[ -z "${CB_SALT:-}" || -z "${OWNER:-}" || -z "${ADMIN:-}" || -z "${FEE_COLLECTOR:-}" ]]; then
    echo "Error: CB_SALT, OWNER, ADMIN, and FEE_COLLECTOR must be set in env for deployment."
    exit 1
  fi
fi

# --- Broadcast & Verify flags -----------------------------------------------
EXTRA_FLAGS=""

if [[ "$DRY_RUN" == "--dry-run" || "$SCRIPT_NAME" == "ComputeCbChainId" || "$SCRIPT_NAME" == "PredictAddresses" ]]; then
  echo ">>> Dry run (no broadcast): $SCRIPT_NAME on $CHAIN"
else
  EXTRA_FLAGS="--broadcast"
  echo ">>> Broadcasting: $SCRIPT_NAME on $CHAIN"

  if [[ "${VERIFY:-}" == "true" ]]; then
    echo ">>> Verification enabled"
    EXTRA_FLAGS="$EXTRA_FLAGS --verify"

    if [[ -n "${VERIFIER:-}" ]]; then
      EXTRA_FLAGS="$EXTRA_FLAGS --verifier ${VERIFIER}"
    fi

    if [[ -n "${VERIFIER_URL:-}" ]]; then
      EXTRA_FLAGS="$EXTRA_FLAGS --verifier-url ${VERIFIER_URL}"
    fi

    if [[ "${VERIFIER:-}" == "etherscan" ]]; then
      if [[ -n "${ETHERSCAN_API_KEY:-}" ]]; then
        EXTRA_FLAGS="$EXTRA_FLAGS --etherscan-api-key ${ETHERSCAN_API_KEY}"
      else
        echo "Warning: VERIFIER is etherscan but ETHERSCAN_API_KEY is not set."
      fi
    elif [[ -n "${VERIFIER_API_KEY:-}" ]]; then
      EXTRA_FLAGS="$EXTRA_FLAGS --verifier-api-key ${VERIFIER_API_KEY}"
    fi
  fi

  if [[ "${SKIP_SIMULATION:-}" == "true" ]]; then
    echo ">>> Skipping simulation"
    EXTRA_FLAGS="$EXTRA_FLAGS --skip-simulation"
  fi
fi

# DeployLocalStack deploys two full diamonds (~36 CREATE2 deployments) in one script run; forge's own gas
# estimation undershoots that well below what actually executes, so it needs an explicit, generous ceiling.
if [[ "$SCRIPT_NAME" == "DeployLocalStack" ]]; then
  EXTRA_FLAGS="$EXTRA_FLAGS --gas-limit 18446744073709551615"
fi

# --- Offline / explicit solc flags, only when requested ----------------------------------------------------------
if [[ "${OFFLINE:-}" == "true" ]]; then
  EXTRA_FLAGS="$EXTRA_FLAGS --offline"
fi
if [[ -n "${SOLC_PATH:-}" ]]; then
  EXTRA_FLAGS="$EXTRA_FLAGS --use ${SOLC_PATH}"
fi

echo ">>> Env: $ENV_FILE"
echo ">>> RPC: ${RPC_URL:-not set}"
echo ">>> DIAMOND: ${DIAMOND:-not set}"
echo ">>> Extra Flags: $EXTRA_FLAGS"
echo ""

cd "$EVM_DIR"

# shellcheck disable=SC2086
forge script "$SCRIPT_FILE" \
  --rpc-url "${RPC_URL}" \
  $EXTRA_FLAGS \
  -vvvv
