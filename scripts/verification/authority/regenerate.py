"""Regenerate the independent oracle from the pinned public IRS PDF.

No calculator imports; page geometry is independent of UsTaxes formula logic.
All validation completes before an atomic output replacement. --check never writes.
"""
import argparse
import collections
import gzip
import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
import pymupdf

PINNED_PDF_SHA256 = "8ae019bd3b28b07b37e46e18597d8e899222a2224ce7482c015b130033403532"

def read_irs_table(pdf):
    doc = pymupdf.open(pdf)
    assert "2025 Returns" in doc[0].get_text(), "Wrong tax year"
    rows = {}
    for page in range(1, 13):  # Printed pages 2–13: Tax Table, not EIC table.
        groups = collections.defaultdict(list)
        for x, y, _, _, word, *_ in doc[page].get_text("words"):
            if not re.fullmatch(r"\d{1,3}(?:,\d{3})*", word):
                continue
            column = 0 if x < 218 else 1 if x < 396 else 2
            groups[(round(y, 1), column)].append((x, word))
        for (y, column), group in groups.items():
            if len(group) != 6:
                continue
            values = [int(w.replace(",", "")) for _, w in sorted(group)]
            lo, hi, *_ = values
            if not (0 <= lo < hi <= 100_000 and hi - lo in (5, 10, 25, 50)):
                continue
            if lo in rows:
                assert rows[lo]["values"] == values, "Conflicting printed rows"
            rows[lo] = {"values": values, "pdf_page": page + 1, "y": y}
    result = [rows[x] for x in sorted(rows)]
    assert result[0]["values"][0] == 0
    assert result[-1]["values"][1] == 100_000
    assert all(a["values"][1] == b["values"][0] for a, b in zip(result, result[1:]))
    return result


def generate(source):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != PINNED_PDF_SHA256:
        raise ValueError("Unreviewed IRS source bytes; review a new release before changing the pin")
    rows = read_irs_table(source)
    table = {"source": "https://www.irs.gov/pub/irs-pdf/i1040tt.pdf",
             "sha256": digest, "tax_year": 2025,
             "columns": ["atLeast", "butLessThan", "single", "mfj", "mfs", "hoh"], "rows": rows}
    return gzip.compress(json.dumps(table, separators=(",", ":"), sort_keys=True).encode(), mtime=0)


def main():
    base = Path(__file__).parent
    p = argparse.ArgumentParser()
    p.add_argument("--source", type=Path, default=os.getenv("TAX_CANDIDATE_TAX_TABLE_SOURCE", base / "i1040tt-2025.pdf"))
    p.add_argument("--output", type=Path, default=base / "independent-tax-table.json.gz")
    p.add_argument("--check", action="store_true")
    a = p.parse_args()
    result = generate(a.source)
    if a.check:
        if result != a.output.read_bytes():
            raise ValueError("Committed oracle differs from independently regenerated source")
    else:
        a.output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(dir=a.output.parent, delete=False) as temp:
            temp.write(result)
            name = temp.name
        try:
            os.replace(name, a.output)
        finally:
            Path(name).unlink(missing_ok=True)
    print(json.dumps({"verified": True, "pdf_sha256": PINNED_PDF_SHA256,
                      "oracle_sha256": hashlib.sha256(result).hexdigest(),
                      "rows": len(json.loads(gzip.decompress(result))["rows"])}))


if __name__ == "__main__":
    main()
