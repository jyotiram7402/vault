import Link from 'next/link'
import { LogoMark } from '@/components/brand/logo'
import { APP_NAME } from '@/lib/config'

export interface AuthCardProps {
  title: string
  subtitle?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
}

/** The frame every auth page shares: small mark, title, form, centred. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-7 inline-flex items-center gap-2 rounded-btn text-safe">
          <LogoMark className="size-7" />
          <span className="plate text-lg text-ink">{APP_NAME}</span>
        </Link>

        <div className="rounded-panel border border-line bg-surface p-6 sm:p-7">
          <h1 className="plate text-2xl text-ink">{title}</h1>
          {subtitle ? <div className="mt-2 text-ink-muted">{subtitle}</div> : null}
          <div className="mt-6">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-ink-muted">{footer}</div> : null}
      </div>
    </main>
  )
}
