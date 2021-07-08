/**
* @fileoverview Validates Single Cell Portal files on the user's computer
*/

/** Get lines and file type from a selected local file */
async function readLinesAndType(file, numLines) {
  return new Promise((resolve, reject) => {
    // Do something with the FileReader object
    const reader = new FileReader()

    reader.onload = function(ev) {
      // Read string from array buffer
      const bufferSlice = ev.target.result.slice(start, nextSlice)
      const enc = new TextDecoder('utf-8')
      const rawString = enc.decode(bufferSlice)
      const lines = rawString.split(/\r?\n/).slice(0, numLines)
      const fileType = file.type
      resolve({ lines, fileType })
    }

    reader.onerror = reject

    // Consider expanding this to stream-read entire file in chunks,
    // while keeping any important bits in a low-memory variable.
    const start = 0
    const sliceSize = 1000 * 1024 // 1 MiB
    const nextSlice = start + sliceSize + 1

    const blob = file.slice(start, nextSlice)

    reader.readAsArrayBuffer(blob)
  })
}

/** Remove white spaces and quotes from a string value */
function clean(value) {
  return value.trim().replaceAll(/"/g, '')
}

/**
 * Verify headers are unique and not empty
 */
function validateUniqueHeaders(headers) {
  const issues = []
  const uniques = new Set(headers)

  console.log('headers', headers)
  console.log('uniques', uniques)

  // Are headers unique?
  if (uniques.size !== headers.length) {
    const seen = new Set()
    const duplicates = new Set()
    headers.forEach(header => {
      if (header in seen) {duplicates.add(header)}
      seen.add(header)
    })

    const dupString = [...duplicates].join(', ')
    const msg = `Duplicate header names are not allowed: ${dupString}`
    issues.push(['error', 'format', msg])
  }

  // Are all headers non-empty?
  if (uniques.has('')) {
    const msg = 'Headers cannot contain empty values'
    issues.push(['error', 'format', msg])
  }

  return { issues }
}

/**
 * Verify second row starts with TYPE (case-insensitive)
 */
function validateTypeKeyword(annotTypes) {
  const issues = []

  const value = annotTypes[0]

  if (value.toUpperCase() === 'TYPE') {
    if (value !== 'TYPE') {
      const msg = `File keyword "TYPE" provided as "${value}"`
      issues.push(['warn', 'format', msg])
    }
  } else {
    const msg =
      'Second row, first column must be "TYPE" (case insensitive).  ' +
      `Provided value was "${value}".`
    issues.push(['error', 'format', msg])
  }

  return issues
}

/**
 * Guess whether column delimiter is comma or tab.
 *
 * Consider using `papaparse` NPM package once it supports ES modules.
 * Upstream task: https://github.com/mholt/PapaParse/pull/875
 */
function sniffDelimiter(lines) {
  const [line1, line2] = lines.slice(0, 2)
  const delimiters = [',', '\t']
  let bestDelimiter

  delimiters.forEach(delimiter => {
    const numFieldsLine1 = line1.split(delimiter).length
    const numFieldsLine2 = line2.split(delimiter).length

    if (numFieldsLine1 !== 1 && numFieldsLine1 === numFieldsLine2) {
      bestDelimiter = delimiter
    }
  })

  return bestDelimiter
}

/** Validate a local metadata file */
async function validateMetadata(file) {
  const { lines, fileType } = await readLinesAndType(file, 2)

  const delimiter = sniffDelimiter(lines)
  const table = lines.map(line => line.split(delimiter))

  let issues = []

  // Remove white spaces and quotes, and lowercase annotTypes
  const headers = table[0].map(header => clean(header))
  const annotTypes = table[1].map(type => clean(type))

  issues = issues.concat(
    validateUniqueHeaders(headers),
    validateTypeKeyword(annotTypes)
  )

  return issues
}

/** Validate a local file */
export default function validateFile(file, studyFileType) {
  if (studyFileType === 'metadata') {validateMetadata(file)}
}
