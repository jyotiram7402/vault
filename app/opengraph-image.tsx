import { ImageResponse } from 'next/og'
import { APP_NAME, APP_TAGLINE } from '@/lib/config'

export const alt = `${APP_NAME} — ${APP_TAGLINE}`
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const BG = '#0F1513'
const SURFACE = '#161E1B'
const INK = '#E5EAE4'
const MUTED = '#97A49C'
const BRASS = '#D6A54E'
const ENAMEL = '#F5F7F2'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: size.width,
          height: size.height,
          display: 'flex',
          alignItems: 'center',
          gap: 72,
          padding: 80,
          background: BG,
        }}
      >
        <div
          style={{
            width: 260,
            height: 260,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 260,
            border: `10px solid ${BRASS}`,
            background: SURFACE,
          }}
        >
          <div
            style={{
              width: 150,
              height: 150,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 150,
              background: '#1B3326',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 48, background: ENAMEL }} />
              <div
                style={{
                  width: 26,
                  height: 44,
                  marginTop: -8,
                  borderRadius: 4,
                  background: ENAMEL,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 680 }}>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, color: INK }}>
            {APP_NAME}
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 20,
              fontSize: 40,
              lineHeight: 1.25,
              color: MUTED,
            }}
          >
            {APP_TAGLINE}
          </div>
          <div style={{ display: 'flex', marginTop: 32, fontSize: 28, color: BRASS }}>
            Encrypted on your device. Always.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
