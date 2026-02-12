#!/usr/bin/env bash

set -euo pipefail

_is_var_name() {
	[[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]
}

print_web_error_and_die() {
	local reason="$1"
	shift || true
	printf 'WEB_ERROR reason=%s\n' "$reason"
	if [[ $# -gt 0 ]]; then
		printf '%s\n' "$*" >&2
	fi
	exit 1
}

require_file() {
	local filePath="$1"
	local createHint="$2"

	if [[ ! -f "$filePath" ]]; then
		print_web_error_and_die "missing_env_file" "$createHint"
	fi
}

require_cmd() {
	local cmd="$1"
	local hint="$2"
	if ! command -v "$cmd" >/dev/null 2>&1; then
		print_web_error_and_die "missing_prereq" "$hint"
	fi
}

require_nonempty_env() {
	local name="$1"
	local v="${!name-}"
	if [[ -z "$v" ]]; then
		print_web_error_and_die "missing_env" "Missing required env var: ${name}"
	fi
}

load_env_file_no_override() {
	local envFile="$1"
	local line key value

	while IFS= read -r line || [[ -n "$line" ]]; do
		line="${line%$'\r'}"
		[[ -z "${line//[[:space:]]/}" ]] && continue
		[[ "$line" == \#* ]] && continue

		if [[ "$line" == export\ * ]]; then
			line="${line#export }"
		fi

		if [[ "$line" != *"="* ]]; then
			continue
		fi

		key="${line%%=*}"
		value="${line#*=}"
		key="${key//[[:space:]]/}"
		value="${value##[[:space:]]}"
		value="${value%%[[:space:]]}"

		_is_var_name "$key" || continue

		if [[ -z "${!key+x}" ]]; then
			if [[ ("$value" == '"'*'"' && "$value" == *'"') || ("$value" == "'"*"'" && "$value" == *"'") ]]; then
				if [[ "${value:0:1}" == "${value: -1}" ]]; then
					value="${value:1:${#value}-2}"
				fi
			fi
			printf -v "$key" '%s' "$value"
			export "$key"
		fi
	done <"$envFile"
}

run_next_dev_with_ready_signal() {
	local mode="$1"
	local webPort="$2"

	if [[ ! -x "./node_modules/.bin/next" ]]; then
		print_web_error_and_die "deps_missing" "Missing frontend dependencies. Run: (cd blog-website/web && npm install)"
	fi

	local lockPath=".next/dev/lock"
	if [[ -e "$lockPath" ]]; then
		if command -v lsof >/dev/null 2>&1; then
			if lsof "$lockPath" >/dev/null 2>&1; then
				print_web_error_and_die "next_lock" "Another Next.js dev server appears to be running (lock is held). Stop it and retry."
			else
				rm -f "$lockPath"
			fi
		else
			print_web_error_and_die "next_lock" "Found a Next.js dev lock file at ${lockPath}. If no dev server is running, remove it and retry."
		fi
	fi

	local tmp_dir=""
	local fifo_path=""
	local next_pid=""
	local ready=0
	local line=""

	tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t 'bw-web')"
	fifo_path="${tmp_dir}/next.out"
	mkfifo "$fifo_path"

	_cleanup_next_dev() {
		if [[ -n "${next_pid:-}" ]]; then
			kill "$next_pid" >/dev/null 2>&1 || true
		fi
		if [[ -n "${tmp_dir:-}" ]]; then
			rm -rf "$tmp_dir" >/dev/null 2>&1 || true
		fi
	}

	trap _cleanup_next_dev INT TERM EXIT

	./node_modules/.bin/next dev -p "$webPort" >"$fifo_path" 2>&1 &
	next_pid="$!"

	while IFS= read -r line; do
		printf '%s\n' "$line"
		if [[ $ready -eq 0 ]]; then
			case "$line" in
			*"Ready in"* | *"ready - started server"* | *"started server"*)
				printf 'WEB_READY mode=%s\n' "$mode"
				ready=1
				;;
			esac
		fi
	done <"$fifo_path"

	wait "$next_pid"
	local rc=$?
	trap - INT TERM EXIT
	rm -rf "$tmp_dir" >/dev/null 2>&1 || true
	return $rc
}
