from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

out = Path(__file__).resolve().parents[1] / "public"
icons = out / "icons"
icons.mkdir(exist_ok=True)

BG = (15, 23, 42)
FG = (34, 211, 238)


def make(size, text="R1", filename=None, path=None):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = max(2, size // 32)
    radius = size // 5
    draw.rounded_rectangle(
        [margin, margin, size - margin - 1, size - margin - 1],
        radius=radius,
        fill=BG,
    )
    ring = max(2, size // 48)
    draw.rounded_rectangle(
        [
            margin + ring * 2,
            margin + ring * 2,
            size - margin - ring * 2 - 1,
            size - margin - ring * 2 - 1,
        ],
        radius=max(4, radius - ring * 2),
        outline=FG,
        width=ring,
    )
    font_size = int(size * 0.42)
    font = None
    for candidate in [
        r"C:\Windows\Fonts\arialbd.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\arial.ttf",
    ]:
        try:
            font = ImageFont.truetype(candidate, font_size)
            break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), text, fill=FG, font=font)
    target = path if path else icons / filename
    img.save(target, "PNG")
    print("wrote", target, size)


for s in (192, 256, 384, 512):
    make(s, filename=f"icon-{s}x{s}.png")

make(512, text="R1", path=out / "logo.png")

frames = []
for s in (16, 32, 48):
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    m = 1
    draw.rounded_rectangle(
        [m, m, s - m - 1, s - m - 1], radius=max(2, s // 5), fill=BG
    )
    fs = max(8, int(s * 0.55))
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", fs)
    except Exception:
        font = ImageFont.load_default()
    text = "R"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (s - tw) / 2 - bbox[0]
    y = (s - th) / 2 - bbox[1]
    draw.text((x, y), text, fill=FG, font=font)
    frames.append(img)

frames[0].save(
    out / "favicon.ico",
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48)],
)
print("wrote favicon.ico")
print("done")
