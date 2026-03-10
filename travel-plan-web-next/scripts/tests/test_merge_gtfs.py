import csv
import tempfile
import unittest
from pathlib import Path

from scripts.merge_gtfs import (
    discover_default_sources,
    merge_feeds,
    parse_source_specs,
    verify_merge,
)


def write_csv(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(headers)
        writer.writerows(rows)


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", newline="", encoding="utf-8") as file:
        reader = csv.DictReader(file)
        headers = list(reader.fieldnames or [])
        return headers, list(reader)


class MergeGtfsTests(unittest.TestCase):
    def test_parse_source_spec_derives_prefix_from_country_name(self) -> None:
        parsed = parse_source_specs(["french-railway-timetable", "german-railway-timetable"])
        self.assertEqual(parsed, [("french-railway-timetable", "fr"), ("german-railway-timetable", "de")])

    def test_discover_default_sources_uses_xxx_railway_timetable_pattern(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            (root / "french-railway-timetable").mkdir()
            (root / "german-railway-timetable").mkdir()
            (root / "euro-railway-timetable").mkdir()
            (root / "eurostar-timetable").mkdir()

            discovered = discover_default_sources(base_dir=root, output_dir_name="euro-railway-timetable")

            self.assertEqual(discovered, [("french-railway-timetable", "fr"), ("german-railway-timetable", "de")])

    def test_merge_unions_columns_and_files(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fr = root / "french-railway-timetable"
            de = root / "german-railway-timetable"

            write_csv(
                fr / "agency.txt",
                ["agency_id", "agency_name"],
                [["1", "SNCF"]],
            )
            write_csv(
                de / "agency.txt",
                ["agency_name", "agency_id", "agency_url"],
                [["DB", "1", "https://bahn.de"]],
            )
            write_csv(
                fr / "feed_info.txt",
                ["feed_id", "feed_lang"],
                [["0", "fr"]],
            )

            merge_feeds(
                base_dir=root,
                sources=[("french-railway-timetable", "fr"), ("german-railway-timetable", "de")],
                output_dir_name="euro-railway-timetable",
                prefix_ids=True,
            )

            output_dir = root / "euro-railway-timetable"
            self.assertTrue((output_dir / "agency.txt").exists())
            self.assertTrue((output_dir / "feed_info.txt").exists())

            headers, rows = read_csv(output_dir / "agency.txt")
            self.assertEqual(headers, ["agency_id", "agency_name", "agency_url"])
            self.assertEqual(rows[0]["agency_id"], "fr:1")
            self.assertEqual(rows[1]["agency_id"], "de:1")
            self.assertEqual(rows[0]["agency_url"], "")

    def test_prefixing_keeps_references_consistent(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fr = root / "french-railway-timetable"
            de = root / "german-railway-timetable"

            write_csv(fr / "agency.txt", ["agency_id", "agency_name"], [["10", "SNCF"]])
            write_csv(de / "agency.txt", ["agency_id", "agency_name"], [["10", "DB"]])

            write_csv(
                fr / "routes.txt",
                ["route_id", "agency_id"],
                [["R1", "10"]],
            )
            write_csv(
                de / "routes.txt",
                ["route_id", "agency_id"],
                [["R1", "10"]],
            )
            write_csv(
                fr / "trips.txt",
                ["route_id", "service_id", "trip_id"],
                [["R1", "S1", "T1"]],
            )
            write_csv(
                de / "trips.txt",
                ["route_id", "service_id", "trip_id"],
                [["R1", "S1", "T1"]],
            )
            write_csv(
                fr / "stop_times.txt",
                ["trip_id", "stop_id", "stop_sequence"],
                [["T1", "STOP1", "1"]],
            )
            write_csv(
                de / "stop_times.txt",
                ["trip_id", "stop_id", "stop_sequence"],
                [["T1", "STOP1", "1"]],
            )
            write_csv(
                fr / "stops.txt",
                ["stop_id", "parent_station"],
                [["STOP1", ""]],
            )
            write_csv(
                de / "stops.txt",
                ["stop_id", "parent_station"],
                [["STOP1", ""]],
            )

            merge_feeds(
                base_dir=root,
                sources=[("french-railway-timetable", "fr"), ("german-railway-timetable", "de")],
                output_dir_name="euro-railway-timetable",
                prefix_ids=True,
            )

            _, trip_rows = read_csv(root / "euro-railway-timetable" / "trips.txt")
            _, stop_time_rows = read_csv(root / "euro-railway-timetable" / "stop_times.txt")

            trip_ids = {row["trip_id"] for row in trip_rows}
            self.assertEqual(trip_ids, {"fr:T1", "de:T1"})
            self.assertEqual({row["trip_id"] for row in stop_time_rows}, trip_ids)
            self.assertEqual(
                {row["route_id"] for row in trip_rows},
                {"fr:R1", "de:R1"},
            )

    def test_merge_adds_train_brand_and_branded_trip_headsign(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fr = root / "french-railway-timetable"
            eu = root / "eurostar-railway-timetable"
            de = root / "german-railway-timetable"

            write_csv(
                fr / "trips.txt",
                ["route_id", "service_id", "trip_id", "trip_headsign"],
                [
                    ["R1", "S1", "OCESN..._F:OUI:...", "9242"],
                    ["R2", "S2", "OCESN..._F:ICN:...", "5789"],
                    ["R3", "S3", "OCESN..._F:TER:...", "860001"],
                ],
            )
            write_csv(
                eu / "trips.txt",
                ["route_id", "service_id", "trip_id", "trip_headsign", "trip_short_name"],
                [["ER1", "ES1", "9002-0314", "Paris-Nord", "9002"]],
            )
            write_csv(
                de / "trips.txt",
                ["route_id", "service_id", "trip_id"],
                [["D1", "DS1", "DT1"]],
            )

            merge_feeds(
                base_dir=root,
                sources=[
                    ("french-railway-timetable", "fr"),
                    ("eurostar-railway-timetable", "eu"),
                    ("german-railway-timetable", "de"),
                ],
                output_dir_name="euro-railway-timetable",
                prefix_ids=True,
            )

            headers, rows = read_csv(root / "euro-railway-timetable" / "trips.txt")
            self.assertIn("train_brand", headers)

            rows_by_trip_id = {row["trip_id"]: row for row in rows}

            self.assertEqual(rows_by_trip_id["fr:OCESN..._F:OUI:..."]["train_brand"], "TGV")
            self.assertEqual(rows_by_trip_id["fr:OCESN..._F:OUI:..."]["trip_headsign"], "TGV 9242")

            self.assertEqual(rows_by_trip_id["fr:OCESN..._F:ICN:..."]["train_brand"], "INTERCITES de nuit")
            self.assertEqual(
                rows_by_trip_id["fr:OCESN..._F:ICN:..."]["trip_headsign"],
                "INTERCITES de nuit 5789",
            )

            self.assertEqual(rows_by_trip_id["fr:OCESN..._F:TER:..."]["train_brand"], "TER")
            self.assertEqual(rows_by_trip_id["fr:OCESN..._F:TER:..."]["trip_headsign"], "TER 860001")

            self.assertEqual(rows_by_trip_id["eu:9002-0314"]["train_brand"], "EST")
            self.assertEqual(rows_by_trip_id["eu:9002-0314"]["trip_headsign"], "EST 9002")

            self.assertEqual(rows_by_trip_id["de:DT1"]["train_brand"], "")

    def test_rebuild_clears_previous_output(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fr = root / "french-railway-timetable"

            write_csv(fr / "agency.txt", ["agency_id", "agency_name"], [["1", "SNCF"]])
            merge_feeds(
                base_dir=root,
                sources=[("french-railway-timetable", "fr")],
                output_dir_name="euro-railway-timetable",
                prefix_ids=True,
            )

            stale_file = root / "euro-railway-timetable" / "stale.txt"
            stale_file.write_text("old", encoding="utf-8")

            merge_feeds(
                base_dir=root,
                sources=[("french-railway-timetable", "fr")],
                output_dir_name="euro-railway-timetable",
                prefix_ids=True,
            )

            self.assertFalse(stale_file.exists())

    def test_verify_merge_passes_on_valid_output(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fr = root / "french-railway-timetable"
            de = root / "german-railway-timetable"

            write_csv(fr / "routes.txt", ["route_id", "agency_id"], [["R1", "A1"]])
            write_csv(fr / "trips.txt", ["route_id", "service_id", "trip_id"], [["R1", "S1", "T1"]])
            write_csv(fr / "calendar_dates.txt", ["service_id", "date", "exception_type"], [["S1", "20260101", "1"]])
            write_csv(fr / "stops.txt", ["stop_id"], [["STOP1"]])
            write_csv(fr / "stop_times.txt", ["trip_id", "stop_id", "stop_sequence"], [["T1", "STOP1", "1"]])

            write_csv(de / "routes.txt", ["route_id", "agency_id"], [["R2", "A2"]])
            write_csv(de / "trips.txt", ["route_id", "service_id", "trip_id"], [["R2", "S2", "T2"]])
            write_csv(de / "calendar_dates.txt", ["service_id", "date", "exception_type"], [["S2", "20260102", "1"]])
            write_csv(de / "stops.txt", ["stop_id"], [["STOP2"]])
            write_csv(de / "stop_times.txt", ["trip_id", "stop_id", "stop_sequence"], [["T2", "STOP2", "1"]])

            sources = [("french-railway-timetable", "fr"), ("german-railway-timetable", "de")]
            merge_feeds(base_dir=root, sources=sources, output_dir_name="euro-railway-timetable", prefix_ids=True)

            report = verify_merge(base_dir=root, sources=sources, output_dir_name="euro-railway-timetable")
            self.assertTrue(report["ok"])
            self.assertEqual(report["missing_output_files"], [])
            self.assertEqual(report["row_mismatches"], [])
            self.assertEqual(report["header_issues"], [])
            self.assertEqual(report["source_malformed_rows_total"], 0)
            self.assertEqual(report["output_malformed_rows_total"], 0)
            self.assertEqual(report["missing_references"]["stop_times_trip_id"], 0)
            self.assertEqual(report["missing_references"]["stop_times_stop_id"], 0)
            self.assertEqual(report["missing_references"]["trips_route_id"], 0)
            self.assertEqual(report["missing_references"]["trips_service_id"], 0)

    def test_verify_merge_fails_when_reference_missing(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            fr = root / "french-railway-timetable"

            write_csv(fr / "trips.txt", ["route_id", "service_id", "trip_id"], [["R1", "S1", "T1"]])
            write_csv(fr / "calendar_dates.txt", ["service_id", "date", "exception_type"], [["S1", "20260101", "1"]])

            sources = [("french-railway-timetable", "fr")]
            merge_feeds(base_dir=root, sources=sources, output_dir_name="euro-railway-timetable", prefix_ids=True)

            report = verify_merge(base_dir=root, sources=sources, output_dir_name="euro-railway-timetable")
            self.assertFalse(report["ok"])
            self.assertGreater(report["missing_references"]["trips_route_id"], 0)


if __name__ == "__main__":
    unittest.main()
