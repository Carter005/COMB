from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "outputs" / "o8-twitter-banner.png"


def main() -> None:
    image = Image.new("RGB", (1500, 500), "#000000")
    draw = ImageDraw.Draw(image)
    regular = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 18)
    small = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 15)
    title = ImageFont.truetype(r"C:\Windows\Fonts\consola.ttf", 27)
    ink = "#b8bbc4"
    dim = "#858b97"
    bright = "#d0d2d8"

    # Keep the left side quiet so the X profile avatar can overlap it safely.
    x = 410
    draw.text((x, 72), "THE OCTOPUS", font=title, fill=bright)
    draw.text((x, 119), "// eight agents. one market memory.", font=small, fill=dim)

    lines = [
        ("const O8 = {", ink),
        ('  agents: 8,', ink),
        ('  input: "on-chain evidence",', ink),
        ('  process: ["observe", "interpret", "disagree"],', ink),
        ('  memory: "preserve"', ink),
        ("};", ink),
        ("", ink),
        ("O8.observe(chain);", bright),
        ("O8.remember(dissent);", bright),
        ("", ink),
        ("> system.status = LIVE", dim),
        ("> evidence.before.interpretation", dim),
    ]
    y = 148
    for line, color in lines:
        draw.text((x, y), line, font=regular, fill=color)
        y += 23

    # A restrained terminal cursor is the only graphic element.
    draw.rectangle((x, 438, x + 11, 440), fill=dim)
    image.save(OUT, optimize=True)
    print(OUT)


if __name__ == "__main__":
    main()
