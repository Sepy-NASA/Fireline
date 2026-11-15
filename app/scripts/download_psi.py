#!/usr/bin/env python3
"""Download a reproducible catalogue of public NASA PSI investigations.

By default this saves search results, investigation metadata and a file
inventory. It never downloads large data files unless --download is supplied.
"""

from __future__ import annotations

import argparse
import fnmatch
import json
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API = "https://psi.nasa.gov/geode-py/ws"
REPOSITORY = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = REPOSITORY / "data/psi-download"
HEADERS = {"Accept": "application/json", "User-Agent": "Fireline-PSI-downloader/1.0"}


def request_json(url: str, body: dict | None = None) -> dict:
    """Fetch a JSON API response and turn networking errors into clear messages."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {**HEADERS, **({"Content-Type": "application/json"} if data else {})}
    try:
        with urlopen(Request(url, data=data, headers=headers), timeout=60) as response:
            return json.load(response)
    except (HTTPError, URLError, json.JSONDecodeError) as error:
        raise RuntimeError(f"PSI request failed: {url}\n{error}") from error


def search(term: str) -> list[dict]:
    query = urlencode({
        "term": term, "source": "psi", "type": "investigation",
        "sort": "Public Release Date", "order": "desc", "size": 500,
    })
    response = request_json(f"{API}/repo/search?{query}")
    return response.get("hits", {}).get("hits", [])


def inventory(accession: str, version: int) -> list[dict]:
    response = request_json(f"{API}/files/v2", {
        "folder": "", "fileType": "study", "studyId": accession, "version": version,
    })

    def flatten(nodes: list[dict]) -> list[dict]:
        result = []
        for node in nodes:
            children = node.get("files") or []
            if children:
                result.extend(flatten(children))
            elif node.get("directory") is False and node.get("key"):
                result.append(node)
        return result

    return flatten(response.get("files", []))


def write_json(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def relative_destination(accession: str, key: str) -> Path:
    """Keep downloaded S3 keys within the local accession directory."""
    parts = PurePosixPath(key).parts
    prefix = ("psi-data", accession)
    if parts[:2] == prefix:
        parts = parts[2:]
    return Path(*parts) if parts else Path("unnamed-file")


def fresh_download_url(accession: str, file_name: str) -> str:
    query = urlencode({"file": file_name, "redirect": "false"})
    try:
        with urlopen(Request(f"{API}/studies/{accession}/download?{query}", headers=HEADERS), timeout=60) as response:
            return response.read().decode().strip()
    except (HTTPError, URLError) as error:
        raise RuntimeError(f"Could not create a download URL for {file_name}: {error}") from error


def download(accession: str, entry: dict, destination: Path) -> None:
    url = fresh_download_url(accession, Path(entry["key"]).name)
    if not url.startswith("https://"):
        raise RuntimeError(f"PSI returned an invalid download URL for {entry['key']}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    try:
        with urlopen(Request(url, headers={"User-Agent": HEADERS["User-Agent"]}), timeout=120) as source, temporary.open("wb") as output:
            shutil.copyfileobj(source, output, 1024 * 1024)
        temporary.replace(destination)
    except (HTTPError, URLError) as error:
        temporary.unlink(missing_ok=True)
        raise RuntimeError(f"Could not download {entry['key']}: {error}") from error


def wanted(entry: dict, patterns: list[str], max_bytes: int) -> bool:
    if entry.get("restricted") or entry.get("restrictedAccess") or not entry.get("visible", True):
        return False
    name = entry.get("key", "").casefold()
    return entry.get("bytes_size", 0) <= max_bytes and any(
        fnmatch.fnmatch(name, pattern.casefold()) for pattern in patterns
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--query", default="combustion", help="PSI search text; used when --id is omitted")
    parser.add_argument("--id", action="append", dest="accessions", help="One PSI accession, e.g. PSI-117; repeatable")
    parser.add_argument("--limit", type=int, default=0, help="Maximum search results; 0 means all")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--download", action="append", default=[], metavar="GLOB", help="Download matching public files, e.g. '*metadata*.zip'")
    parser.add_argument("--max-mb", type=float, default=100, help="Largest file downloaded (0 = no limit)")
    args = parser.parse_args()
    if args.limit < 0 or args.max_mb < 0:
        parser.error("--limit and --max-mb cannot be negative")

    output = args.output.resolve()
    if args.accessions:
        accessions = args.accessions
        hits = []
    else:
        hits = search(args.query)
        if args.limit:
            hits = hits[:args.limit]
        accessions = [hit.get("_source", {}).get("Accession") for hit in hits]
        accessions = [item for item in accessions if item]
        write_json(output / "catalog.json", {
            "source": f"{API}/repo/search", "query": args.query,
            "downloadedAt": datetime.now(timezone.utc).isoformat(), "investigations": hits,
        })

    max_bytes = sys.maxsize if args.max_mb == 0 else int(args.max_mb * 1024 * 1024)
    for accession in dict.fromkeys(accessions):
        detail = request_json(f"{API}/repo/investigations/{accession}")
        files = inventory(accession, int(detail["version"]))
        folder = output / accession
        write_json(folder / "investigation.json", detail)
        write_json(folder / "files.json", files)
        print(f"{accession}: saved metadata and {len(files)} public/restricted file records")

        for entry in files:
            if wanted(entry, args.download, max_bytes):
                target = folder / relative_destination(accession, entry["key"])
                if target.exists() and target.stat().st_size == entry.get("bytes_size"):
                    print(f"  exists: {target.name}")
                    continue
                download(accession, entry, target)
                print(f"  downloaded: {target.name}")


if __name__ == "__main__":
    main()
