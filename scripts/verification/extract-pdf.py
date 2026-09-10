"""Read the actual HTTP-generated PDFs with an independent PDF library."""
import json
import sys
from pathlib import Path

import pymupdf

root = Path(sys.argv[1])
names = {
    "wages": "topmostSubform[0].Page1[0].f1_47[0]",
    "taxable": "topmostSubform[0].Page2[0].f2_06[0]",
    "tax": "topmostSubform[0].Page2[0].f2_16[0]",
    "withholding": "topmostSubform[0].Page2[0].f2_17[0]",
    "payments": "topmostSubform[0].Page2[0].f2_29[0]",
    "refund": "topmostSubform[0].Page2[0].f2_31[0]",
    "owed": "topmostSubform[0].Page2[0].f2_35[0]",
}
result = json.loads((root / "results.json").read_text())
failures = []
for case in result["results"]:
    if not case.get("pdfFile"):
        failures.append(case["id"] + ":missing PDF")
        continue
    with pymupdf.open(root / case["pdfFile"]) as pdf:
        fields = {widget.field_name: widget.field_value for page in pdf for widget in page.widgets()}
        case["pdfLines"] = {name: int(fields[field] or "0") for name, field in names.items()}
    case["pdfLineAgreement"] = case["pdfLines"] == case["expected"]
    if not case["pdfLineAgreement"] or not case["httpAgreement"] or not case["attachmentAgreement"]:
        failures.append(case["id"] + ":line, HTTP or attachment disagreement")
    print(case["id"], case["pdfLineAgreement"], case["pdfLines"])
(root / "results-with-pdf.json").write_text(json.dumps(result, indent=2) + "\n")

if failures:
    raise SystemExit("Verification failed: " + ", ".join(failures))
