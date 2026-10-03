"""Synthetic PDF QA. Requires pypdf/pdfplumber; --render also needs Poppler."""
import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess

import pdfplumber
from pypdf import PdfReader


class TextBlocks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        if data.strip():
            self.parts.append(data)


def normalized(value):
    return re.sub(r"\s+", "", value).replace("•", "").replace("·", "")


parser = argparse.ArgumentParser()
parser.add_argument("--render", action="store_true")
args = parser.parse_args()
folder = Path("experiments/email-cv-delivery/qa")
results = []
for pdf in sorted(folder.glob("*.pdf")):
    reader = PdfReader(pdf)
    text = "\n".join(page.extract_text() for page in reader.pages)
    blocks = TextBlocks()
    blocks.feed(pdf.with_suffix(".html").read_text(encoding="utf-8"))
    missing = [part for part in blocks.parts if normalized(part) not in normalized(text)]
    with pdfplumber.open(pdf) as document:
        outside = [
            {"page": index + 1, "text": char["text"]}
            for index, page in enumerate(document.pages)
            for char in page.chars
            if char["x0"] < 39 or char["x1"] > page.width - 39
            or char["top"] < 30 or char["bottom"] > page.height - 30
        ]
    result = {
        "case": pdf.stem, "pages": len(reader.pages),
        "a4": all(abs(float(page.mediabox.width) - 595.276) < 1
                  and abs(float(page.mediabox.height) - 841.89) < 1 for page in reader.pages),
        "missing": missing, "outside_margin": outside, "bytes": pdf.stat().st_size,
    }
    assert not missing and not outside and result["a4"], result
    assert all(page.extract_text().strip() for page in reader.pages), "Empty page"
    assert result["pages"] == (2 if pdf.stem in ["long", "urls"] else 1), result
    assert "AI CV Copilot" not in text and "Print / Save PDF" not in text
    pdf.with_suffix(".txt").write_text("\n".join(line.rstrip() for line in text.splitlines()) + "\n", encoding="utf-8")
    if args.render:
        # Clear only previous renders belonging to this synthetic fixture.
        for image in folder.glob(f"{pdf.stem}-*.png"):
            image.unlink()
        subprocess.run(["pdftoppm", "-scale-to", "1200", "-png", str(pdf), str(pdf.with_suffix(""))], check=True)
    results.append(result)
assert len(results) == 8, "Generate the eight synthetic fixtures first"
folder.joinpath("results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(results, ensure_ascii=False, indent=2))
