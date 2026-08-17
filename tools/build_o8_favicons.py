from pathlib import Path

from PIL import Image, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "outputs" / "o8-ascii-logo-v3.png"
PUBLIC = ROOT / "public"


def square_subject(image: Image.Image) -> Image.Image:
    # Keep the octopus itself and omit the caption so the mark remains legible in a tab.
    subject = image.crop((120, 55, 904, 895))
    side = max(subject.size)
    canvas = Image.new("RGB", (side, side), "black")
    canvas.paste(subject, ((side - subject.width) // 2, (side - subject.height) // 2))
    return canvas


def favicon_source(image: Image.Image) -> Image.Image:
    # Thicken the terminal glyphs before reduction; MaxFilter expands the pale strokes.
    return image.filter(ImageFilter.MaxFilter(5))


def main() -> None:
    PUBLIC.mkdir(parents=True, exist_ok=True)
    original = Image.open(SOURCE).convert("RGB")
    original.save(PUBLIC / "o8-logo.png", optimize=True)

    mark = square_subject(original)
    mark.save(PUBLIC / "o8-mark.png", optimize=True)

    strengthened = favicon_source(mark)
    header_mark = strengthened.resize((512, 512), Image.Resampling.LANCZOS)
    alpha = ImageOps.grayscale(header_mark).point(lambda value: min(255, round(value * 255 / 184)))
    transparent_mark = Image.new("RGBA", header_mark.size, (184, 187, 196, 0))
    transparent_mark.putalpha(alpha)
    transparent_mark.save(PUBLIC / "o8-header-logo.png", optimize=True)

    for size in (16, 32, 48, 180, 192, 512):
        icon = strengthened.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(PUBLIC / f"favicon-{size}.png", optimize=True)

    strengthened.save(
        PUBLIC / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )


if __name__ == "__main__":
    main()
