#!/usr/bin/env bash
set -euo pipefail

log() {
	# shellcheck disable=SC2145
	printf '%s\n' "$*" >&2
}

die() {
	log "error: $*"
	exit 1
}

need_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"
}

require_file() {
	[[ -f "$1" ]] || die "$2"
}

require_env() {
	local key="$1"
	local hint="$2"
	if [[ -z "${!key:-}" ]]; then
		die "$key is required. ${hint}"
	fi
}

load_env_file_allow_env_override() {
	# Loads KEY=VALUE lines into the environment, but does not overwrite
	# variables already set in the parent process.
	local env_file="$1"

	while IFS= read -r line || [[ -n "$line" ]]; do
		# Trim leading/trailing whitespace.
		line="${line#${line%%[![:space:]]*}}"
		line="${line%${line##*[![:space:]]}}"

		[[ -z "$line" ]] && continue
		[[ "$line" == \#* ]] && continue

		# Support lines like: export KEY=VALUE
		if [[ "$line" == export\ * ]]; then
			line="${line#export }"
			line="${line#${line%%[![:space:]]*}}"
		fi

		[[ "$line" == *=* ]] || continue

		local key="${line%%=*}"
		local value="${line#*=}"

		# Trim whitespace around the key.
		key="${key%${key##*[![:space:]]}}"
		key="${key#${key%%[![:space:]]*}}"

		# Skip invalid keys.
		[[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue

		# Do not overwrite already-set variables.
		if [[ -n "${!key:-}" ]]; then
			continue
		fi

		# Strip simple surrounding quotes.
		if [[ "$value" =~ ^\".*\"$ ]]; then
			value="${value:1:${#value}-2}"
		elif [[ "$value" =~ ^\'.*\'$ ]]; then
			value="${value:1:${#value}-2}"
		fi

		export "$key=$value"
	done <"$env_file"
}

require_docker_running() {
	need_cmd docker
	docker info >/dev/null 2>&1 || die "Docker does not appear to be running. Start Docker Desktop and retry."
	docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (docker compose ...)."
}

compose() {
	local project="$1"
	local compose_file="$2"
	shift 2
	docker compose -p "$project" -f "$compose_file" "$@"
}

wait_for_compose_service_healthy() {
	local project="$1"
	local compose_file="$2"
	local service="$3"
	local timeout_seconds="$4"

	local start
	start="$(date +%s)"

	while true; do
		local cid
		cid="$(compose "$project" "$compose_file" ps -q "$service" 2>/dev/null || true)"
		if [[ -z "$cid" ]]; then
			die "compose service '$service' is not running (project: $project). Try running the matching db-up script."
		fi

		local health
		health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid" 2>/dev/null || true)"
		case "$health" in
		healthy)
			return 0
			;;
		unhealthy)
			log "compose service '$service' is unhealthy (project: $project)."
			compose "$project" "$compose_file" logs "$service" >&2 || true
			return 1
			;;
		no-healthcheck)
			# Fall back to container running status.
			local status
			status="$(docker inspect -f '{{.State.Status}}' "$cid" 2>/dev/null || true)"
			if [[ "$status" == running ]]; then
				return 0
			fi
			;;
		esac

		local now
		now="$(date +%s)"
		if ((now - start >= timeout_seconds)); then
			log "timed out waiting for '$service' to become healthy (project: $project)"
			compose "$project" "$compose_file" ps >&2 || true
			compose "$project" "$compose_file" logs "$service" >&2 || true
			return 1
		fi

		sleep 1
	done
}

wait_for_http_200() {
	local url="$1"
	local timeout_seconds="$2"

	need_cmd curl

	local start
	start="$(date +%s)"
	while true; do
		local code
		code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$url" 2>/dev/null || true)"
		if [[ "$code" == "200" ]]; then
			return 0
		fi

		local now
		now="$(date +%s)"
		if ((now - start >= timeout_seconds)); then
			return 1
		fi
		sleep 1
	done
}

api_readiness_url_from_env() {
	# Priority:
	# - API_READINESS_URL: full URL
	# - API_BIND: host:port (only if host is not 0.0.0.0/::)
	local bind="${API_BIND:-}"

	if [[ -n "${API_READINESS_URL:-}" ]]; then
		printf '%s' "$API_READINESS_URL"
		return 0
	fi

	if [[ -z "$bind" ]]; then
		return 1
	fi

	# Expect host:port (no IPv6 bracket support here; keep it simple).
	if [[ "$bind" != *:* ]]; then
		return 1
	fi

	local host="${bind%%:*}"
	local port="${bind##*:}"

	if [[ "$host" == "0.0.0.0" || "$host" == "::" ]]; then
		return 2
	fi

	printf 'http://%s:%s/v1/auth/session' "$host" "$port"
}
