/**
 * A hand-written RFC 4180 CSV reader and writer.
 *
 * Handles quoted fields, doubled quotes inside them, newlines inside quotes,
 * CRLF line endings and a UTF-8 byte-order mark — which is what actually comes
 * out of Chrome, Edge, Firefox, Safari, Bitwarden, LastPass and 1Password.
 */

/** Parse CSV text into rows of fields. Blank trailing lines are dropped. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let index = 0

  const endField = () => {
    row.push(field)
    field = ''
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  while (index < text.length) {
    const character = text[index]

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index += 2
          continue
        }
        inQuotes = false
        index += 1
        continue
      }
      field += character
      index += 1
      continue
    }

    if (character === '"' && field === '') {
      inQuotes = true
      index += 1
      continue
    }
    if (character === ',') {
      endField()
      index += 1
      continue
    }
    if (character === '\r') {
      // Swallow CR; the LF that follows ends the row.
      index += 1
      if (text[index] === '\n') index += 1
      endRow()
      continue
    }
    if (character === '\n') {
      index += 1
      endRow()
      continue
    }

    field += character
    index += 1
  }

  // Whatever is left over is the final row, unless the file ended cleanly.
  if (field !== '' || row.length > 0) endRow()

  return rows.filter((entry) => entry.some((value) => value.trim() !== ''))
}

function escapeField(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function stringifyCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(escapeField).join(',')).join('\r\n')
}

/**
 * Index the header row by normalised name, so lookups ignore case, spaces,
 * underscores and hyphens.
 */
export function headerIndex(header: readonly string[]): Map<string, number> {
  const map = new Map<string, number>()
  header.forEach((name, index) => {
    const key = name.trim().toLowerCase().replace(/[\s_-]+/g, '')
    if (key && !map.has(key)) map.set(key, index)
  })
  return map
}

/** First matching column from a list of accepted header names. */
export function pickColumn(
  index: ReadonlyMap<string, number>,
  names: readonly string[],
): number | null {
  for (const name of names) {
    const key = name.toLowerCase().replace(/[\s_-]+/g, '')
    const found = index.get(key)
    if (found !== undefined) return found
  }
  return null
}
