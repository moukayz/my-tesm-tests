#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
API_ENV_PATH=${API_ENV_PATH:-"${REPO_ROOT}/apps/api/.env"}
WEB_ENV_PATH=${WEB_ENV_PATH:-"${REPO_ROOT}/apps/web/.env"}
ENV_OVERRIDE_PATH=${ENV_OVERRIDE_PATH:-"${REPO_ROOT}/env/.env.e2e-test"}

if [ ! -f "${API_ENV_PATH}" ]; then
	echo "API env file not found at ${API_ENV_PATH}." >&2
	exit 1
fi

if [ ! -f "${WEB_ENV_PATH}" ]; then
	echo "Web env file not found at ${WEB_ENV_PATH}." >&2
	exit 1
fi

if [ ! -f "${ENV_OVERRIDE_PATH}" ]; then
	echo "Override env file not found at ${ENV_OVERRIDE_PATH}." >&2
	exit 1
fi

set -a
# shellcheck source=/dev/null
source "${API_ENV_PATH}"
source "${WEB_ENV_PATH}"
source "${ENV_OVERRIDE_PATH}"
set +a

require_env() {
	local name=$1
	if [ -z "${!name:-}" ]; then
		echo "${name} must be set in ${API_ENV_PATH} or ${CONFIG_PATH}." >&2
		exit 1
	fi
}

require_env API_PORT
require_env WEB_PORT
require_env API_HOST
require_env WEB_HOST
require_env API_PROTOCOL
require_env WEB_PROTOCOL
require_env MODEL_CONFIG_PATH
require_env MODEL_CONFIG_FORMAT
require_env MOCK_OPENAI
require_env MOCK_OPENAI_ERROR_TRIGGER
require_env NODE_ENV

if ! command -v lsof >/dev/null 2>&1; then
	echo "lsof is required to detect free ports." >&2
	exit 1
fi

is_port_free() {
	! lsof -iTCP:"$1" -sTCP:LISTEN -n -P >/dev/null 2>&1
}

find_free_port() {
	local port="$1"
	local attempts=0
	local limit="${PORT_SCAN_LIMIT:-20}"

	while ! is_port_free "${port}"; do
		attempts=$((attempts + 1))
		if [ "${attempts}" -gt "${limit}" ]; then
			echo "No free port found after ${limit} attempts starting at ${1}." >&2
			exit 1
		fi
		port=$((port + 1))
	done

	echo "${port}"
}

API_PORT=$(find_free_port "${API_PORT}")
WEB_PORT=$(find_free_port "${WEB_PORT}")
API_APP_ROOT="${REPO_ROOT}/apps/api"

if [[ "${MODEL_CONFIG_PATH}" != /* ]]; then
	MODEL_CONFIG_PATH="${API_APP_ROOT}/${MODEL_CONFIG_PATH}"
fi

export MODEL_CONFIG_PATH
export MODEL_CONFIG_FORMAT
export MOCK_OPENAI
export MOCK_OPENAI_ERROR_TRIGGER
export NODE_ENV
export E2E_BASE_URL="${WEB_PROTOCOL}://${WEB_HOST}:${WEB_PORT}"
export E2E_API_URL="${API_PROTOCOL}://${API_HOST}:${API_PORT}"
export API_PROXY_TARGET="${API_PROTOCOL}://${API_HOST}:${API_PORT}"
export WEB_ENV_PATH
export WEB_ENV_OVERRIDE_PATH="${ENV_OVERRIDE_PATH}"
export API_ENV_PATH
export API_ENV_OVERRIDE_PATH="${ENV_OVERRIDE_PATH}"

echo "API_PROXY_TARGET: ${API_PROXY_TARGET}"

echo "Using E2E API port ${API_PORT}."
echo "Using E2E web port ${WEB_PORT}."

npm --prefix apps/e2e run test
