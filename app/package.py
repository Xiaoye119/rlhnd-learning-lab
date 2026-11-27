"""Bundle the portable teaching material, excluding raw research PDFs."""
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
files = [ROOT / p for p in [
    "index.html", "report.md", "README.md", "分享讲稿.md", "serve_demo.py",
    "ATTRIBUTION.md", ".gitignore", ".gitattributes",
    "notes/验收记录.md", "outputs/preview-home.png", "outputs/preview-lab.png"
]]
for folder in ["assets", "app", "tests"]:
    files.extend(p for p in (ROOT / folder).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
out = ROOT / "outputs/RLHND-learning-kit.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for path in files:
        z.write(path, path.relative_to(ROOT).as_posix())
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert z.read("serve_demo.py").startswith(b'"""')
    assert z.read("index.html").startswith(b"<!doctype html>")
    print(f"Verified ZIP: {len(z.namelist())} files, {out.stat().st_size / 1024 / 1024:.1f} MiB")
