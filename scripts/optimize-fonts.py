"""Make the lighter web fonts the site loads on every page (public/fonts/*-web.woff2).

The originals come from Google Fonts (see public/fonts/SOURCES.json) and stay in the folder.
Each copy drops TrueType hinting (browsers on phones and Macs ignore it; Chrome and Edge on
Windows render the same, checked side by side) and, for the Arabic files, the character ranges
Arabic text on the site does not use (Arabic Supplement and Extended-A/B for African and Quranic
annotation letters, and most Presentation Forms-A). OpenType shaping is kept, so every
letter joins as before. A character outside the kept ranges falls back to the next font.

Usage: pip install fonttools brotli && python scripts/optimize-fonts.py
The unicode ranges below must match the unicode-range lines in app/fonts.css.
"""
import os
import subprocess
import sys

FONTS = os.path.join(os.path.dirname(__file__), '..', 'public', 'fonts')
ARABIC = 'U+0600-06FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FD3E-FD3F,U+FDF2,U+FDFA-FDFB,U+FE70-FE74,U+FE76-FEFC'
FILES = [
    ('ibm-plex-arabic-1.woff2', 'plex-arabic-400-web.woff2', ARABIC),
    ('ibm-plex-arabic-9.woff2', 'plex-arabic-600-web.woff2', ARABIC),
    ('ibm-plex-arabic-4.woff2', 'plex-latin-400-web.woff2', '*'),
    ('ibm-plex-arabic-12.woff2', 'plex-latin-600-web.woff2', '*'),
    ('markazi-text-arabic-var.woff2', 'markazi-arabic-web.woff2', ARABIC),
]

for source, target, unicodes in FILES:
    subprocess.run([
        sys.executable, '-m', 'fontTools.subset', os.path.join(FONTS, source),
        '--unicodes=' + unicodes, '--layout-features=*', '--flavor=woff2', '--no-hinting',
        '--output-file=' + os.path.join(FONTS, target),
    ], check=True)
    print(target, os.path.getsize(os.path.join(FONTS, source)), '->', os.path.getsize(os.path.join(FONTS, target)))
