export function safeNextPath(value: string | null | undefined, fallback = '/vault'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return fallback
  return value
}
