#!/usr/bin/env python3
"""Tải SVG Ionicons (giống @expo/vector-icons) và sinh src/components/icons/ionicons.ts.
Chạy 1 lần offline được — mọi glyph nhúng thẳng vào bundle."""
import urllib.request, pathlib, sys, json

ICONS = """home home-outline list list-outline location location-outline person person-outline
calendar calendar-outline briefcase briefcase-outline hardware-chip arrow-back arrow-forward
phone-portrait-outline lock-closed-outline eye-outline eye-off-outline logo-google logo-facebook
notifications notifications-outline sparkles mic mic-outline search wallet-outline star star-outline
school heart heart-outline navigate navigate-outline checkmark checkmark-circle checkmark-circle-outline
shield-checkmark shield-checkmark-outline hourglass-outline time time-outline headset-outline
chevron-forward chevron-back chevron-down close close-circle add add-circle warning warning-outline
alert-circle alert-circle-outline cloud-offline cloud-offline-outline send camera-outline images-outline
call-outline mail-outline person-add-outline people people-outline book happy restaurant cube cube-outline
bag bag-handle-outline apps walk car car-outline receipt receipt-outline information-circle
information-circle-outline locate locate-outline map map-outline pin pulse radar shield flash flash-outline
rocket trophy gift gift-outline document-text document-text-outline journal pencil create-outline
trash-outline settings-outline help-circle-outline log-out-outline refresh refresh-outline
copy-outline download-outline open-outline scan qr-code qr-code-outline wallet cash-outline card-outline
stats-chart stats-chart-outline trending-up ribbon medal diamond lock-open-outline finger-print-outline
fitness nutrition medkit bandage chatbubble-ellipses chatbubble-ellipses-outline chatbubbles
chatbubbles-outline megaphone megaphone-outline bell-outline notifications-off-outline business
pricetag pricetag-outline calendar-clear-outline calendar-number-outline timer-outline
stop-circle-outline play pause radio-outline wifi battery-half globe-outline key-outline at-outline
person-circle-outline happy-outline sad-outline thumbs-up thumbs-up-outline flag flag-outline
hand-left-outline speedometer-outline sync-outline ban bar-chart-outline flash-alert""".split()

OUT = pathlib.Path(__file__).resolve().parent.parent / "src" / "components" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
result, failed = {}, []
for name in ICONS:
    url = f"https://cdn.jsdelivr.net/npm/ionicons@7.4.0/dist/svg/{name}.svg"
    try:
        svg = urllib.request.urlopen(url, timeout=20).read().decode()
        # inner content sau <svg ...>
        inner = svg[svg.index(">", svg.index("<svg")) + 1: svg.rindex("</svg>")]
        result[name] = inner.strip()
    except Exception as e:
        failed.append((name, str(e)))

ts = ["// AUTO-GENERATED từ ionicons@7.4.0 (giống @expo/vector-icons của RN). Đừng sửa tay.",
      "export const IONICONS: Record<string, string> = {"]
for k in sorted(result):
    ts.append(f'  "{k}": {json.dumps(result[k])},')
ts.append("};\n")
(OUT / "ionicons.ts").write_text("\n".join(ts))
print(f"OK {len(result)} icons -> {OUT/'ionicons.ts'}")
if failed:
    print("FAILED:", *failed, sep="\n  ", file=sys.stderr)
    sys.exit(1)
