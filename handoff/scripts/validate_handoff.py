#!/usr/bin/env python3
"""Check the handoff's content, references and file integrity without network access."""
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


def load(relative_path: str):
    return json.loads((ROOT / relative_path).read_text(encoding="utf-8"))


def check_handoff() -> dict:
    checks: list[dict] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        checks.append({"name": name, "passed": bool(condition), "detail": detail})

    portfolio = load("data/portfolio.json")
    catalogue = load("data/magicui-catalog.json")
    source = ROOT / portfolio["sources"][0]["path"]
    actual_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    check("Source CV SHA-256", actual_hash == portfolio["sources"][0]["sha256"], actual_hash)
    check("Identity", portfolio["profile"]["name"] == "Tianjian Qin" and portfolio["profile"]["credentials"] == "PhD")
    check("Completed Groningen PhD", portfolio["education"][0]["institution"] == "University of Groningen" and portfolio["education"][0]["end"] == "2026")
    check("WUR postdoc", portfolio["experience"][0]["institution"] == "Wageningen University & Research" and portfolio["experience"][0]["start"] == "2025")

    publications = portfolio["publications"]
    check("Eight peer-reviewed publications", sum(p["status"] == "peer-reviewed" for p in publications) == 8)
    check("Two preprints", sum(p["status"] == "preprint" for p in publications) == 2)
    check("Unique publication IDs", len({p["id"] for p in publications}) == len(publications))
    check("Unique DOIs", len({p["doi"] for p in publications}) == len(publications))
    check("Valid DOI shapes", all(re.fullmatch(r"10\.\d{4,9}/\S+", p["doi"]) for p in publications))
    check("Owner appears once per publication", all(sum(a["isOwner"] for a in p["authors"]) == 1 for p in publications))
    growth = next(p for p in publications if p["id"] == "growth-2019")
    check("Equal contribution markers", [a["displayName"] for a in growth["authors"] if a["equalContribution"]] == ["Qin, T.-J.", "Guan, Y.-T."])
    netforge = next(p for p in publications if p["id"] == "netforge-2026")
    check("NetForge author form and status", netforge["authors"][1]["displayName"] == "Atamer Balkan, B." and netforge["status"] == "preprint")
    check("NextdAI in development", next(p for p in portfolio["programmes"] if p["id"] == "nextdai")["status"] == "In development")
    check("IMBIT completed in 2025", any(p["id"] == "imbit" and p["status"] == "Completed" and p["year"] == 2025 for p in portfolio["programmes"]))
    check("Three collaborator packages", {s["id"] for s in portfolio["software"] if s["role"] == "Collaborator"} == {"treestats", "ddd", "daisie"})
    check("Fifteen toolkit icons", len(portfolio["iconCloudItems"]) == 15)
    check("No invented portrait", portfolio["profile"]["portrait"] is None)
    check("Globe coordinates unsupplied", all(m["coordinates"] is None for m in portfolio["globe"]["markerCities"]))

    check("Six primary destinations in order", [(n["label"], n["path"]) for n in portfolio["navigation"]] == [
        ("Home", "/"), ("Research", "/research"), ("Papers", "/publications"),
        ("Software", "/software"), ("About", "/about"), ("Photography", "/photography"),
    ])
    photography = load("data/photography.json")
    check("Photography production seed is not a fixture", photography["fixtureOnly"] is False)
    check("Travel log is unconfirmed", photography["travelLogStatus"] == "unconfirmed")
    check("No invented countries or photographs", photography["countries"] == [] and photography["albums"] == [] and photography["photos"] == [])
    fixture = load("reference/fixtures/photography.test.json")
    check("Synthetic fixture is explicitly marked", fixture["fixtureOnly"] is True)
    public_countries = [c for c in fixture["countries"] if c["visibility"] == "public" and c["visitConfirmed"]]
    codes = {c["code"] for c in public_countries}
    albums = [a for a in fixture["albums"] if a["status"] == "published" and a["countryCode"] in codes]
    album_ids = {a["id"] for a in albums}
    photos = [p for p in fixture["photos"] if p["status"] == "published" and p["albumId"] in album_ids]
    check("Fixture totals are 3 countries, 2 albums and 3 photos", (len(codes), len(albums), len(photos)) == (3, 2, 3))
    photo_check = load("verification/photography-model-check.json")
    check("Photography reference model check report", photo_check["passed"] and len(photo_check["checks"]) == 42 and photo_check["typecheck"]["passed"])
    lock = load("data/upstream-lock.json")
    check("Dotted Map source review is pinned", "Dotted Map" in lock["scope"]["deepSourceReview"] and lock["photographySourceReview"]["blobSha"] == "fbb85928fc721dd89230dce4b374ee7aedf9bc85")
    check("Photography specification and guide exist", (ROOT / "spec/10-photography.md").is_file() and (ROOT / "PHOTOGRAPHY_CONTENT_GUIDE.md").is_file())
    check("All six routes appear in the browser contract", all(f'"{n["path"]}"' in (ROOT / "reference/portfolio.acceptance.spec.ts").read_text() for n in portfolio["navigation"]))

    publication_ids = {p["id"] for p in publications}
    software_ids = {s["id"] for s in portfolio["software"]}
    check("Project relations resolve", all(set(p["publicationIds"]) <= publication_ids and set(p["softwareIds"]) <= software_ids for p in portfolio["projects"]))
    article_ids = set()
    for path in (ROOT / "content/research").glob("*.mdx"):
        match = re.search(r"^projectId: ([a-z0-9-]+)$", path.read_text(), re.MULTILINE)
        if match:
            article_ids.add(match.group(1))
    check("Four article relations resolve", article_ids == {p["id"] for p in portfolio["projects"]})
    rows = catalogue["documentedComponents"]
    check("77 unique documented components", len(rows) == 77 and len({r["id"] for r in rows}) == 77)
    check("Five required core components", {r["id"] for r in rows if r["decision"] == "Core"} == {"globe", "icon-cloud", "terminal", "animated-beam", "dotted-map"})
    check("All catalogue entries have decisions and references", all(r["decision"] and r["docs"].startswith("https://magicui.design/docs/components/") and r["source"] for r in rows))
    check("Extra source entries separate", {r["id"] for r in catalogue["sourceExtras"]} == {"client-tweet-card", "animated-subscribe-button"})

    bib = (ROOT / "public/publications.bib").read_text(encoding="utf-8")
    check("BibTeX has ten records", len(re.findall(r"^@(article|misc)\{", bib, re.MULTILINE)) == 10)
    check("BibTeX contains every DOI", all(p["doi"] in bib for p in publications))
    pdf = (ROOT / "public/Tianjian-Qin-CV.pdf").read_bytes()
    check("CV PDF signature", pdf.startswith(b"%PDF-"))
    check("Supplied asset paths resolve", all((ROOT / a["path"]).is_file() for a in load("data/assets.json")["available"]))

    broken = []
    for path in ROOT.rglob("*.md"):
        text = path.read_text(encoding="utf-8")
        for link in re.findall(r"\[[^\]]+\]\(([^\s)]+)\)", text):
            parsed = urlsplit(link)
            if parsed.scheme or link.startswith("#") or link.startswith("/"):
                continue
            target = (path.parent / unquote(parsed.path)).resolve()
            if not target.exists():
                broken.append(f"{path.relative_to(ROOT)} -> {link}")
    check("Internal Markdown links", not broken, "; ".join(broken))

    parse_errors = []
    for path in ROOT.rglob("*.json"):
        # The generated result is not an input to its own validation.
        if path == ROOT / "verification/handoff-check.json":
            continue
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            parse_errors.append(f"{path.relative_to(ROOT)}: {error}")
    check("JSON input files parse", not parse_errors, "; ".join(parse_errors))

    failures = []
    manifest = load("verification/files.sha256.json")
    for relative_path, expected in manifest["files"].items():
        path = ROOT / relative_path
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            failures.append(relative_path)
    check("File manifest hashes", not failures, "; ".join(failures))
    forbidden_binaries = [str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.suffix.lower() in {".ttf", ".otf", ".woff", ".woff2"}]
    check("No font binaries distributed", not forbidden_binaries, "; ".join(forbidden_binaries))
    palette = load("verification/palette-contrast.json")
    check("All 14 token contrast pairs pass their targets", len(palette["checks"]) == 14 and all(c["passed"] for c in palette["checks"]))
    return {"scope": "Local handoff integrity; no website build, browser tests or external URL checks", "passed": all(c["passed"] for c in checks), "checks": checks}


def main() -> int:
    try:
        result = check_handoff()
    except (OSError, ValueError, KeyError, StopIteration) as error:
        print(f"Handoff check could not complete: {error}", file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
