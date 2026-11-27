"""Build the portable HTML; original source assets remain unchanged."""
from pathlib import Path
import base64
import json
import mimetypes
import re
import markdown

ROOT = Path(__file__).resolve().parents[1]
def data_uri(path):
    data = path.read_bytes()
    return "data:" + (mimetypes.guess_type(path.name)[0] or "application/octet-stream") + ";base64," + base64.b64encode(data).decode("ascii")

md = markdown.Markdown(extensions=["tables", "fenced_code", "toc"], extension_configs={"toc": {"toc_depth": "2-2"}})
report = md.convert((ROOT / "report.md").read_text(encoding="utf-8"))
report = re.sub(r"<table>(.*?)</table>", r'<div class="table-wrap"><table>\1</table></div>', report, flags=re.S)
figures = {p.relative_to(ROOT).as_posix(): data_uri(p) for p in sorted((ROOT / "assets").glob("*.png"))}
template = (ROOT / "app/template.html").read_text(encoding="utf-8")
media = {"figures": figures, "pose": [], "tactile": []}
for name in ["egodex1_original.mp4", "egodex1_rlhnd_2d.mp4", "egodex1_rlhnd_3d.mp4"]:
    media["pose"].append(data_uri(ROOT / "assets/videos" / name))
for name in ["tactile_ot_fablab2_input.mp4", "tactile_ot_fablab2_ours.mp4", "tactile_ot_fablab2_force_ours.mp4"]:
    media["tactile"].append(data_uri(ROOT / "assets/videos" / name))
for token, value in {
    "__CSS__": (ROOT / "app/style.css").read_text(encoding="utf-8"),
    "__REPORT__": report, "__TOC__": md.toc,
    "__MATH__": (ROOT / "app/math.js").read_text(encoding="utf-8"),
    "__JS__": (ROOT / "app/demo.js").read_text(encoding="utf-8"),
    "__MEDIA__": json.dumps(media, ensure_ascii=False)
}.items():
    template = template.replace(token, value)
# Use one embedded data copy per figure, including figures repeated in the report.
template = re.sub(r'src="(assets/[^"]+)"', lambda m: 'data-figure="'+m.group(1)+'"', template)
bootstrap = "document.querySelectorAll('[data-figure]').forEach(img=>img.src=MEDIA.figures[img.dataset.figure]);"
template = template.replace(";</script><script>/*", ";" + bootstrap + "</script><script>/*", 1)
if bootstrap not in template:
    raise RuntimeError("Image bootstrap marker missing")
assert not re.search(r"__(?:CSS|REPORT|TOC|MATH|JS|MEDIA)__", template)
(ROOT / "index.html").write_text(template, encoding="utf-8")
print(f"Built index.html: {(ROOT/'index.html').stat().st_size / 1024 / 1024:.1f} MiB; {len(figures)} original figures; 6 videos")
