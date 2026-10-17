"""Biên dịch lại CSS từ toàn bộ trang đã xuất, giữ các theme gốc."""
import os
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("EDUCARELINK_SOURCE", ROOT.parent / "educarelink-main"))
CONF = ROOT / "scripts/upstream-tailwind"
CONF.mkdir(exist_ok=True)
for path in (SOURCE / "frontend/tailwind-build").glob("*.js"):
    shutil.copy2(path, CONF / path.name)

for name in ("default", "radius-a", "radius-b", "plain"):
    config = CONF / ("build-" + name + ".config.js")
    with config.open("a", encoding="utf-8") as stream:
        stream.write('\nmodule.exports.content = ["./src/public/pages/*.html", "./src/public/static/js/*.js"];\n')
    subprocess.run([
        "node", str(ROOT / "node_modules/tailwindcss/lib/cli.js"),
        "-c", str(config), "-o",
        str(ROOT / ("src/public/static/css/tailwind-" + name + ".css")),
        "--minify",
    ], cwd=ROOT, check=True)
