from __future__ import annotations

import argparse
import csv
import re
import shutil
from pathlib import Path
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Sequence, Tuple, cast

SOURCE_SPEC = Tuple[str, str]

COUNTRY_PREFIX_MAP = {
    "french": "fr",
    "france": "fr",
    "german": "de",
    "germany": "de",
    "italian": "it",
    "italy": "it",
    "spanish": "es",
    "spain": "es",
    "belgian": "be",
    "belgium": "be",
    "dutch": "nl",
    "netherlands": "nl",
    "swiss": "ch",
    "switzerland": "ch",
    "austrian": "at",
    "austria": "at",
    "polish": "pl",
    "poland": "pl",
    "czech": "cz",
    "czechia": "cz",
    "portuguese": "pt",
    "portugal": "pt",
}

PREFIXABLE_FIELDS_BY_FILE = {
    "agency.txt": {"agency_id"},
    "routes.txt": {"route_id", "agency_id"},
    "trips.txt": {"trip_id", "route_id", "service_id", "shape_id", "block_id"},
    "stop_times.txt": {"trip_id", "stop_id"},
    "stops.txt": {"stop_id", "parent_station"},
    "calendar.txt": {"service_id"},
    "calendar_dates.txt": {"service_id"},
    "shapes.txt": {"shape_id"},
    "transfers.txt": {"from_stop_id", "to_stop_id", "from_route_id", "to_route_id"},
    "feed_info.txt": {"feed_id"},
    "attributions.txt": {"attribution_id"},
}

FRENCH_TRAIN_BRAND_RULES: List[Tuple[str, str]] = [
    ("F:OGO:", "OUIGO"),
    ("F:OUI:", "TGV"),
    ("F:ICN:", "INTERCITES de nuit"),
    ("F:IC:", "INTERCITES"),
    ("F:TER:", "TER"),
    ("F:LYR:", "LYRIA"),
    ("F:ICE:", "ICE"),
    ("F:TT:", "TRAMTRAIN"),
    ("F:NAV:", "NAVETTE"),
    ("F:TRN:", "TRAIN"),
]


def parse_source_specs(source_specs: Sequence[str]) -> List[SOURCE_SPEC]:
    parsed: List[SOURCE_SPEC] = []
    for source_spec in source_specs:
        source_spec = source_spec.strip()
        if ":" in source_spec:
            folder, prefix = source_spec.split(":", 1)
        else:
            folder = source_spec
            prefix = derive_prefix_from_folder(folder)

        folder = folder.strip()
        prefix = prefix.strip().lower()
        if not folder or not prefix:
            raise ValueError(f"Invalid source '{source_spec}'. Folder and prefix are required.")
        parsed.append((folder, prefix))
    return parsed


def derive_prefix_from_folder(folder_name: str) -> str:
    lowered = folder_name.lower().strip()
    stem = lowered
    if lowered.endswith("-railway-timetable"):
        stem = lowered[: -len("-railway-timetable")]
    elif lowered.endswith("-timetable"):
        stem = lowered[: -len("-timetable")]

    if stem in COUNTRY_PREFIX_MAP:
        return COUNTRY_PREFIX_MAP[stem]

    alpha = re.sub(r"[^a-z]", "", stem)
    if len(alpha) >= 2:
        return alpha[:2]
    if alpha:
        return alpha
    raise ValueError(f"Cannot derive prefix from folder '{folder_name}'. Use folder:prefix format.")


def discover_default_sources(base_dir: Path, output_dir_name: str) -> List[SOURCE_SPEC]:
    discovered: List[SOURCE_SPEC] = []
    for entry in sorted(base_dir.iterdir(), key=lambda p: p.name):
        if not entry.is_dir():
            continue
        if entry.name == output_dir_name:
            continue
        if not entry.name.endswith("-railway-timetable"):
            continue
        discovered.append((entry.name, derive_prefix_from_folder(entry.name)))
    return discovered


def list_gtfs_files(base_dir: Path, sources: Sequence[SOURCE_SPEC]) -> List[str]:
    file_names = set()
    for folder, _prefix in sources:
        source_dir = base_dir / folder
        if not source_dir.exists() or not source_dir.is_dir():
            raise FileNotFoundError(f"Source directory does not exist: {source_dir}")

        for file_path in source_dir.glob("*.txt"):
            file_names.add(file_path.name)

    return sorted(file_names)


def read_header(file_path: Path) -> List[str]:
    with file_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.reader(file)
        return next(reader, [])


def build_header_unions(base_dir: Path, files: Sequence[str], sources: Sequence[SOURCE_SPEC]) -> Dict[str, List[str]]:
    header_union_by_file: Dict[str, List[str]] = {}

    for file_name in files:
        merged_header: List[str] = []
        seen = set()
        for folder, _prefix in sources:
            file_path = base_dir / folder / file_name
            if not file_path.exists():
                continue

            for column in read_header(file_path):
                if column not in seen:
                    seen.add(column)
                    merged_header.append(column)

        if file_name == "trips.txt" and "train_brand" not in seen:
            merged_header.append("train_brand")

        header_union_by_file[file_name] = merged_header

    return header_union_by_file


def maybe_prefix(value: str, prefix: str) -> str:
    if not value:
        return value
    already_prefixed = value.startswith(f"{prefix}:")
    if already_prefixed:
        return value
    return f"{prefix}:{value}"


def prefix_row_ids(file_name: str, row: Dict[str, str], prefix: str) -> None:
    for field in PREFIXABLE_FIELDS_BY_FILE.get(file_name, set()):
        if field not in row:
            continue
        row[field] = maybe_prefix(row[field], prefix)


def infer_french_train_brand(trip_id: str) -> str:
    trip_id_upper = trip_id.upper()
    for token, brand in FRENCH_TRAIN_BRAND_RULES:
        if token in trip_id_upper:
            return brand
    return "UNKNOWN"


def apply_trip_branding(file_name: str, row: Dict[str, str], source_folder: str) -> None:
    if file_name != "trips.txt":
        return

    folder_lower = source_folder.lower()
    row.setdefault("train_brand", "")

    if "french" in folder_lower:
        brand = infer_french_train_brand(row.get("trip_id", ""))
        row["train_brand"] = brand
        train_number = (row.get("trip_headsign") or "").strip()
        if train_number:
            row["trip_headsign"] = f"{brand} {train_number}"
        return

    if "eurostar" in folder_lower:
        brand = "EST"
        row["train_brand"] = brand
        train_number = (row.get("trip_short_name") or row.get("trip_headsign") or "").strip()
        if train_number:
            row["trip_headsign"] = f"{brand} {train_number}"
        return


def merge_feeds(
    base_dir: Path,
    sources: Sequence[SOURCE_SPEC],
    output_dir_name: str = "euro-railway-timetable",
    prefix_ids: bool = True,
) -> Dict[str, int]:
    files = list_gtfs_files(base_dir=base_dir, sources=sources)
    headers_by_file = build_header_unions(base_dir=base_dir, files=files, sources=sources)

    output_dir = base_dir / output_dir_name
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    row_count_by_file: Dict[str, int] = {}

    for file_name in files:
        header = headers_by_file[file_name]
        output_file = output_dir / file_name

        with output_file.open("w", encoding="utf-8", newline="") as out_file:
            writer = csv.DictWriter(out_file, fieldnames=header)
            writer.writeheader()

            merged_rows = 0
            for folder, prefix in sources:
                source_file = base_dir / folder / file_name
                if not source_file.exists():
                    continue

                with source_file.open("r", encoding="utf-8", newline="") as in_file:
                    reader = csv.DictReader(in_file)
                    for row in reader:
                        normalized = {column: row.get(column, "") for column in header}
                        if prefix_ids:
                            prefix_row_ids(file_name=file_name, row=normalized, prefix=prefix)
                        apply_trip_branding(file_name=file_name, row=normalized, source_folder=folder)
                        writer.writerow(normalized)
                        merged_rows += 1

            row_count_by_file[file_name] = merged_rows

    return row_count_by_file


def _count_rows_and_bad(file_path: Path) -> Tuple[List[str], int, int]:
    with file_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.reader(file)
        header = next(reader, [])
        width = len(header)
        rows = 0
        bad_rows = 0
        for row in reader:
            rows += 1
            if len(row) != width:
                bad_rows += 1
    return list(header), rows, bad_rows


def _load_id_set(file_path: Path, field: str) -> set[str]:
    values: set[str] = set()
    if not file_path.exists():
        return values
    with file_path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        for row in reader:
            value = (row.get(field) or "").strip()
            if value:
                values.add(value)
    return values


def verify_merge(base_dir: Path, sources: Sequence[SOURCE_SPEC], output_dir_name: str) -> Dict[str, Any]:
    output_dir = base_dir / output_dir_name

    source_rows = defaultdict(int)
    source_headers = defaultdict(list)
    source_bad_rows = defaultdict(int)
    source_files: set[str] = set()

    for folder, _prefix in sources:
        source_dir = base_dir / folder
        if not source_dir.exists() or not source_dir.is_dir():
            raise FileNotFoundError(f"Source directory does not exist: {source_dir}")
        for file_path in sorted(source_dir.glob("*.txt")):
            header, rows, bad_rows = _count_rows_and_bad(file_path)
            source_files.add(file_path.name)
            source_rows[file_path.name] += rows
            source_bad_rows[file_path.name] += bad_rows
            source_headers[file_path.name].append(set(header))

    missing_output_files = sorted([name for name in source_files if not (output_dir / name).exists()])

    row_mismatches = []
    header_issues = []
    output_bad_rows = defaultdict(int)

    for file_name in sorted(source_files):
        out_path = output_dir / file_name
        if not out_path.exists():
            continue

        out_header, out_rows, out_bad = _count_rows_and_bad(out_path)
        output_bad_rows[file_name] += out_bad

        if out_rows != source_rows[file_name]:
            row_mismatches.append((file_name, source_rows[file_name], out_rows))

        out_header_set = set(out_header)
        for source_header_set in source_headers[file_name]:
            if not source_header_set.issubset(out_header_set):
                header_issues.append(file_name)
                break

    trips = _load_id_set(output_dir / "trips.txt", "trip_id")
    stops = _load_id_set(output_dir / "stops.txt", "stop_id")
    routes = _load_id_set(output_dir / "routes.txt", "route_id")
    services = _load_id_set(output_dir / "calendar_dates.txt", "service_id") | _load_id_set(
        output_dir / "calendar.txt", "service_id"
    )

    missing_stop_times_trip_refs = 0
    missing_stop_times_stop_refs = 0
    stop_times_path = output_dir / "stop_times.txt"
    if stop_times_path.exists():
        with stop_times_path.open("r", encoding="utf-8", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                trip_id = (row.get("trip_id") or "").strip()
                stop_id = (row.get("stop_id") or "").strip()
                if trip_id and trip_id not in trips:
                    missing_stop_times_trip_refs += 1
                if stop_id and stop_id not in stops:
                    missing_stop_times_stop_refs += 1

    missing_trip_route_refs = 0
    missing_trip_service_refs = 0
    trips_path = output_dir / "trips.txt"
    if trips_path.exists():
        with trips_path.open("r", encoding="utf-8", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                route_id = (row.get("route_id") or "").strip()
                service_id = (row.get("service_id") or "").strip()
                if route_id and route_id not in routes:
                    missing_trip_route_refs += 1
                if service_id and service_id not in services:
                    missing_trip_service_refs += 1

    report = {
        "ok": False,
        "missing_output_files": missing_output_files,
        "row_mismatches": row_mismatches,
        "header_issues": sorted(set(header_issues)),
        "source_malformed_rows_total": sum(source_bad_rows.values()),
        "output_malformed_rows_total": sum(output_bad_rows.values()),
        "missing_references": {
            "stop_times_trip_id": missing_stop_times_trip_refs,
            "stop_times_stop_id": missing_stop_times_stop_refs,
            "trips_route_id": missing_trip_route_refs,
            "trips_service_id": missing_trip_service_refs,
        },
    }

    report["ok"] = (
        len(report["missing_output_files"]) == 0
        and len(report["row_mismatches"]) == 0
        and len(report["header_issues"]) == 0
        and report["source_malformed_rows_total"] == 0
        and report["output_malformed_rows_total"] == 0
        and all(count == 0 for count in report["missing_references"].values())
    )

    return report


def format_verify_summary(report: Dict[str, Any]) -> Iterable[str]:
    status = "PASS" if report["ok"] else "FAIL"
    yield f"Verification: {status}"
    yield f"Missing output files: {len(report['missing_output_files'])}"
    yield f"Row mismatches: {len(report['row_mismatches'])}"
    yield f"Header issues: {len(report['header_issues'])}"
    yield f"Source malformed rows: {report['source_malformed_rows_total']}"
    yield f"Output malformed rows: {report['output_malformed_rows_total']}"

    missing_refs = cast(Dict[str, int], report["missing_references"])
    yield "Missing references:"
    yield f"  - stop_times.trip_id -> trips.trip_id: {missing_refs['stop_times_trip_id']}"
    yield f"  - stop_times.stop_id -> stops.stop_id: {missing_refs['stop_times_stop_id']}"
    yield f"  - trips.route_id -> routes.route_id: {missing_refs['trips_route_id']}"
    yield f"  - trips.service_id -> calendar/calendar_dates.service_id: {missing_refs['trips_service_id']}"

    missing_output_files = cast(List[str], report["missing_output_files"])
    if missing_output_files:
        yield f"Missing files detail: {', '.join(missing_output_files)}"


def format_summary(output_dir: Path, stats: Dict[str, int]) -> Iterable[str]:
    total_rows = sum(stats.values())
    yield f"Merged GTFS feeds into: {output_dir}"
    yield f"Files merged: {len(stats)}"
    yield f"Rows merged: {total_rows}"
    for file_name, count in sorted(stats.items()):
        yield f"  - {file_name}: {count} rows"


def main() -> int:
    parser = argparse.ArgumentParser(description="Merge multiple GTFS feed folders into one output folder.")
    parser.add_argument(
        "--base-dir",
        default=".",
        help="Base directory containing GTFS source folders.",
    )
    parser.add_argument(
        "--output",
        default="euro-railway-timetable",
        help="Output folder name under base directory.",
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        default=None,
        help="Source feed folders with optional prefixes. Format: folder or folder:prefix",
    )
    parser.add_argument(
        "--default-load",
        action="store_true",
        help=(
            "Auto-discover all '*-railway-timetable' folders under base-dir except output folder, "
            "and derive prefix from country name."
        ),
    )
    parser.add_argument(
        "--no-prefix",
        action="store_true",
        help="Disable ID prefixing. Not recommended due to potential ID collisions.",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Run post-merge verification checks for completeness, structure, and references.",
    )

    args = parser.parse_args()

    base_dir = Path(args.base_dir).resolve()
    if args.default_load:
        sources = discover_default_sources(base_dir=base_dir, output_dir_name=args.output)
    elif args.sources:
        sources = parse_source_specs(args.sources)
    else:
        sources = parse_source_specs(
            [
                "french-railway-timetable:fr",
                "eurostar-railway-timetable:eu",
                "german-railway-timetable:de",
            ]
        )

    if not sources:
        raise ValueError("No input sources found. Provide --sources or use --default-load with matching folders.")

    stats = merge_feeds(
        base_dir=base_dir,
        sources=sources,
        output_dir_name=args.output,
        prefix_ids=not args.no_prefix,
    )

    for line in format_summary(base_dir / args.output, stats):
        print(line)

    if args.verify:
        report = verify_merge(base_dir=base_dir, sources=sources, output_dir_name=args.output)
        for line in format_verify_summary(report):
            print(line)
        if not report["ok"]:
            return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
