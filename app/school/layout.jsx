import '@/app/legacy-styles';

// Not redesigned yet: keeps the legacy stylesheet bundle scoped to this route.
// Musnad letters need a font most phones lack (iPhone has none). Google Fonts serves it with a
// unicode-range, so the font file downloads only on pages that actually show Musnad letters.
const musnadFont = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Old+South+Arabian&display=swap';
export default function LegacyStylesLayout({children}) {
  return <>
    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
    <link rel="stylesheet" href={musnadFont}/>
    {children}
  </>;
}
