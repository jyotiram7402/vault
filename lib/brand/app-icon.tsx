import { ImageResponse } from 'next/og'

/**
 * The app icon, generated in code.
 *
 * No raster images are committed to this repository, so every PNG the manifest
 * needs is drawn here with plain flex boxes and rounded corners — shapes that
 * the renderer behind next/og handles without needing a font file.
 *
 * Maskable icons keep the mark inside the central 80% on a full-bleed
 * background, so platforms that crop to a circle or a squircle never clip it.
 */

const SAFE = '#2E4A3F'
const SAFE_DARK = '#24402F'
const SAFE_DEEP = '#1B3326'
const BRASS = '#D6A54E'
const ENAMEL = '#F5F7F2'

export function renderAppIcon(size: number, opts: { maskable?: boolean } = {}): ImageResponse {
  const maskable = opts.maskable === true
  // The mark occupies 80% of a maskable icon, and 92% of a normal one.
  const mark = size * (maskable ? 0.8 : 0.92)
  const ring = Math.max(2, size * 0.035)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: SAFE,
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: mark * 0.86,
            height: mark * 0.86,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: mark,
            border: `${ring}px solid ${BRASS}`,
            background: SAFE_DARK,
          }}
        >
          <div
            style={{
              width: mark * 0.56,
              height: mark * 0.56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: mark,
              background: SAFE_DEEP,
            }}
          >
            {/* Keyhole: a disc over a tapered-looking shaft. */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: mark * 0.18,
                  height: mark * 0.18,
                  borderRadius: mark,
                  background: ENAMEL,
                }}
              />
              <div
                style={{
                  width: mark * 0.1,
                  height: mark * 0.17,
                  marginTop: -mark * 0.03,
                  borderRadius: mark * 0.02,
                  background: ENAMEL,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    ),
    { width: size, height: size },
  )
}
