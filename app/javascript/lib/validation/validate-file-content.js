/**
* @fileoverview Validates Single Cell Portal files on the user's computer
*
* Where feasible, these functions and data structures align with those in
* Ingest Pipeline [1].  Such consistency across codebases eases QA, debugging,
* and overall maintainability.
*
* [1] E.g. https://github.com/broadinstitute/scp-ingest-pipeline/blob/development/ingest/validation/validate_metadata.py
*/

import { log } from 'lib/metrics-api'
import { readFileBytes } from './io'
import ChunkedLineReader from './chunked-line-reader'
import { PARSEABLE_TYPES } from 'components/upload/upload-utils'
import { parse } from 'query-string'

/**
 * Splits the line on a delimiter, and
 * removes leading and trailing white spaces and quotes from values
 */
function parseLine(line, delimiter) {
  return line.split(delimiter).map(entry => entry.trim().replaceAll(/^"|"$/g, ''))
}

/**
 * Verify headers are unique and not empty
 */
function validateUnique(headers) {
  // eslint-disable-next-line max-len
  // Mirrors https://github.com/broadinstitute/scp-ingest-pipeline/blob/0b6289dd91f877e5921a871680602d776271217f/ingest/annotations.py#L233
  const issues = []
  const uniques = new Set(headers)

  // Are headers unique?
  if (uniques.size !== headers.length) {
    const seen = new Set()
    const duplicates = new Set()
    headers.forEach(header => {
      if (seen.has(header)) {duplicates.add(header)}
      seen.add(header)
    })

    const dupString = [...duplicates].join(', ')
    const msg = `Duplicate header names are not allowed: ${dupString}`
    issues.push(['error', 'format:cap:unique', msg])
  }

  // Are all headers non-empty?
  if (uniques.has('')) {
    const msg = 'Headers cannot contain empty values'
    issues.push(['error', 'format:cap:no-empty', msg])
  }

  return issues
}

/**
 * Helper function to verify first pair of headers is NAME or TYPE
 */
function validateKeyword(values, expectedValue) {
  const issues = []

  const ordinal = (expectedValue === 'NAME') ? 'First' : 'Second'
  const location = `${ordinal} row, first column`
  const value = values[0]
  const actual = `Your value was "${value}".`

  if (value.toUpperCase() === expectedValue) {
    if (value !== expectedValue) {
      const msg =
        `${location} should be ${expectedValue}. ${actual}`
      issues.push(['warn', 'format', msg])
    }
  } else {
    const msg =
      `${location} must be "${expectedValue}" (case insensitive). ${actual}`
    const logType = expectedValue.toLowerCase()
    issues.push(['error', `format:cap:${logType}`, msg])
  }

  return issues
}

/**
 * Verify second row starts with NAME (case-insensitive)
 */
function validateNameKeyword(headers) {
  // eslint-disable-next-line max-len
  // Mirrors https://github.com/broadinstitute/scp-ingest-pipeline/blob/0b6289dd91f877e5921a871680602d776271217f/ingest/annotations.py#L216
  return validateKeyword(headers, 'NAME')
}

/**
 * Verify second row starts with TYPE (case-insensitive)
 */
function validateTypeKeyword(annotTypes) {
  // eslint-disable-next-line max-len
  // Mirrors https://github.com/broadinstitute/scp-ingest-pipeline/blob/0b6289dd91f877e5921a871680602d776271217f/ingest/annotations.py#L258
  return validateKeyword(annotTypes, 'TYPE')
}

/**
 * Verify type annotations (second row) contain only "group" or "numeric"
 */
function validateGroupOrNumeric(annotTypes) {
  const issues = []
  const invalidTypes = []

  // Skip the TYPE keyword
  const types = annotTypes.slice(1)

  types.forEach(type => {
    if (!['group', 'numeric'].includes(type.toLowerCase())) {
      if (type === '') {
        // If the value is a blank space, store a higher visibility
        // string for error reporting
        invalidTypes.push('<empty value>')
      } else {
        invalidTypes.push(type)
      }
    }
  })

  if (invalidTypes.length > 0) {
    const badValues = `"${invalidTypes.join('", "')}"`
    const msg =
      'Second row, all columns after first must be "group" or "numeric". ' +
      `Your values included ${badValues}`

    issues.push(['error', 'format:cap:group-or-numeric', msg])
  }

  return issues
}

/**
 * Verify equal counts for headers and annotation types
 */
function validateEqualCount(headers, annotTypes) {
  const issues = []

  if (headers.length > annotTypes.length) {
    const msg =
      'First row must have same number of columns as second row. ' +
      `Your first row has ${headers.length} header columns and ` +
      `your second row has ${annotTypes.length} annotation type columns.`
    issues.push(['error', 'format:cap:count', msg])
  }

  return issues
}


/**
 * Verify cell names are each unique for a cluster or metadata file
 * creates and uses 'cellNames' and 'duplicateCellNames' properties on dataObj to track
 * cell names between calls to this function
 */
function validateUniqueCellNamesWithinFile(parsedLine, isLastLine, dataObj) {
  const issues = []

  dataObj.cellNames = dataObj.cellNames ? dataObj.cellNames : new Set()
  dataObj.duplicateCellNames = dataObj.duplicateCellNames ? dataObj.duplicateCellNames : new Set()

  const cell = parsedLine[0]
  if (!dataObj.cellNames.has(cell)) {
    dataObj.cellNames.add(cell)
  } else {
    dataObj.duplicateCellNames.add(cell)
  }
  if (isLastLine && dataObj.duplicateCellNames.size > 0) {
    const nameTxt = (dataObj.duplicateCellNames.size > 1) ? 'duplicates' : 'duplicate'
    const dupString = [...dataObj.duplicateCellNames].slice(0, 10).join(', ')
    const msg = `Cell names must be unique within a file. ${dataObj.duplicateCellNames.size} ${nameTxt} found, including: ${dupString}`
    issues.push(['error', 'duplicate:cells-within-file', msg])
  }
  return issues
}

/**
 * Guess whether column delimiter is comma or tab
 *
 * Consider using `papaparse` NPM package once it supports ES modules.
 * Upstream task: https://github.com/mholt/PapaParse/pull/875
 */
function sniffDelimiter([line1, line2], mimeType) {
  const delimiters = [',', '\t']
  let bestDelimiter

  delimiters.forEach(delimiter => {
    const numFieldsLine1 = line1.split(delimiter).length
    const numFieldsLine2 = line2.split(delimiter).length

    if (numFieldsLine1 !== 1 && numFieldsLine1 === numFieldsLine2) {
      bestDelimiter = delimiter
    }
  })

  if (typeof bestDelimiter === 'undefined') {
    if (mimeType === 'text/tab-separated-values') {
      bestDelimiter = '\t'
    } else {
      // fall back on comma -- which may give the most useful error message to the user
      bestDelimiter = ','
    }
  }
  return bestDelimiter
}

/**
 * Verify cap format for a cluster or metadata file
 *
 * The "cap" of an SCP study file is its first two lines, i.e.:
 *  - Header (row 1), and
 *  - Annotation types (row 2)
 *
 * Cap lines are like meta-information lines in other file formats
 * (e.g. VCF), but do not begin with pound signs (#).
 */
function validateCapFormat([headers, annotTypes]) {
  let issues = []
  if (!headers || !annotTypes) {
    return [['error', 'cap:format:no-header', 'File does not have at least 2 non-empty header rows']]
  }

  // Check format rules that apply to both metadata and cluster files
  issues = issues.concat(
    validateUnique(headers),
    validateNameKeyword(headers),
    validateTypeKeyword(annotTypes),
    validateGroupOrNumeric(annotTypes),
    validateEqualCount(headers, annotTypes)
  )
  return issues
}

/** Verifies metadata file has no X, Y, or Z coordinate headers */
function validateNoMetadataCoordinates(parsedHeaders) {
  const issues = []

  const invalidHeaders = parsedHeaders[0].filter(header => {
    return ['x', 'y', 'z'].includes(header.toLowerCase())
  })

  if (invalidHeaders.length > 0) {
    const badValues = `"${invalidHeaders.join('", "')}"`
    const msg =
      'First row must not include coordinates X, Y, or Z ' +
      '(case insensitive) as column header values. ' +
      `Your values included ${badValues}.`
    issues.push(['error', 'format:cap:metadata-no-coordinates', msg])
  }

  return issues
}

/** Verifies cluster file has X and Y coordinate headers */
function validateClusterCoordinates(parsedHeaders) {
  const issues = []

  const xyHeaders = parsedHeaders[0].filter(header => {
    return ['x', 'y'].includes(header.toLowerCase())
  })

  if (xyHeaders.length < 2) {
    const msg =
      'First row must include coordinates X and Y ' +
      '(case insensitive) as column header values.'
    issues.push(['error', 'format:cap:cluster-coordinates', msg])
  }

  return issues
}

/** parse a metadata file, and return an array of issues, along with file parsing info */
export async function parseMetadataFile(chunker, mimeType) {
  const { parsedHeaders, delimiter } = await getParsedHeaderLines(chunker, mimeType, 2)

  let issues = validateCapFormat(parsedHeaders, delimiter)
  issues = issues.concat(validateNoMetadataCoordinates(parsedHeaders))
  // add other header validations here

  const dataObj = {} // object to track multi-line validation concerns
  await chunker.iterateLines((line, lineNum, isLastLine) => {
    const parsedLine = parseLine(line, delimiter)
    issues = issues.concat(validateUniqueCellNamesWithinFile(parsedLine, isLastLine, dataObj))
    // add other line-by-line validations here
  })
  return { issues, delimiter, numColumns: parsedHeaders[0].length }
}

/** parse a cluster file, and return an array of issues, along with file parsing info */
export async function parseClusterFile(chunker, mimeType) {
  const { parsedHeaders, delimiter } = await getParsedHeaderLines(chunker, mimeType, 2)

  let issues = validateCapFormat(parsedHeaders, delimiter)
  issues = issues.concat(validateClusterCoordinates(parsedHeaders))
  // add other header validations here

  const dataObj = {} // object to track multi-line validation concerns
  await chunker.iterateLines((line, lineNum, isLastLine) => {
    const parsedLine = parseLine(line, delimiter)
    issues = issues.concat(validateUniqueCellNamesWithinFile(parsedLine, isLastLine, dataObj))
    // add other line-by-line validations here
  })

  return { issues, delimiter, numColumns: parsedHeaders[0].length }
}

/** reads in the specified number of header lines, sniffs the delimiter, and returns the
 * lines parsed by the sniffed delimiter
 */
export async function getParsedHeaderLines(chunker, mimeType, numHeaderLines=2) {
  const headerLines = []
  await chunker.iterateLines((line, lineNum, isLastLine) => {
    headerLines.push(line)
  }, 2)
  const delimiter = sniffDelimiter(headerLines, mimeType)
  const parsedHeaders = headerLines.map(l => parseLine(l, delimiter))
  return { parsedHeaders, delimiter }
}


/** confirm that the presence/absence of a .gz suffix matches the lead byte of the file */
export async function validateGzipEncoding(file) {
  const GZIP_MAGIC_NUMBER = '\x1F'
  const fileName = file.name
  const issues = []
  let isGzipped = null

  // read a single byte from the file to check the magic number
  const firstByte = await readFileBytes(file, 0, 1)
  if (fileName.endsWith('.gz') || fileName.endsWith('.bam')) {
    if (firstByte === GZIP_MAGIC_NUMBER) {
      isGzipped = true
    } else {
      issues.push(['error', 'encoding:invalid-gzip-magic-number',
        'File has a .gz or .bam suffix but does not seem to be gzipped'])
    }
  } else {
    if (firstByte === GZIP_MAGIC_NUMBER) {
      issues.push(['error', 'encoding:missing-gz-extension',
        'File seems to be gzipped but does not have a ".gz" or ".bam" extension'])
    } else {
      isGzipped = false
    }
  }
  return { isGzipped, issues }
}


/** reads the file and returns a fileInfo object along with an array of issues */
async function parseFile(file, fileType) {
  const fileInfo = {
    fileSize: file.size,
    fileName: file.name,
    linesRead: 0,
    numColumns: null,
    fileMimeType: file.type,
    fileType,
    delimiter: null,
    isGzipped: null
  }

  const { issues, isGzipped } = await validateGzipEncoding(file)
  fileInfo.isGzipped = isGzipped

  // if the file is compressed or we can't figure out the compression, don't try to parse further
  if (isGzipped || issues.length || !PARSEABLE_TYPES.includes(fileType)) {
    return { fileInfo, issues }
  }

  const parseResult = { fileInfo, issues: [] }
  const parseFunctions = {
    'Cluster': parseClusterFile,
    'Metadata': parseMetadataFile
  }
  if (parseFunctions[fileType]) {
    const chunker = new ChunkedLineReader(file)
    const { issues, delimiter, numColumns } = await parseFunctions[fileType](chunker, fileInfo.fileMimeType)
    fileInfo.linesRead = chunker.linesRead
    fileInfo.delimiter = delimiter
    fileInfo.numColumns = numColumns
    parseResult.issues = issues
  }
  return parseResult
}

/** Validate a local file, return { errors, summary } object, where errors is an array of errors, and summary
 * is a message like "Your file had 2 errors"
 */
export async function validateFileContent(file, fileType) {
  const { fileInfo, issues } = await parseFile(file, fileType)

  const errorObj = formatIssues(issues)
  const logProps = getLogProps(fileInfo, errorObj)
  log('file-validation', logProps)

  return errorObj
}

/** take an array of [type, key, msg] issues, and format it */
function formatIssues(issues) {
  // Ingest Pipeline reports "issues", which includes "errors" and "warnings".
  // Keep issue type distinction in this module to ease porting, but for now
  // only report errors.
  const errors = issues.filter(issue => issue[0] === 'error')

  let summary = ''
  if (errors.length > 0) {
    const numErrors = errors.length
    const errorsTerm = (numErrors === 1) ? 'error' : 'errors'
    summary = `Your file had ${numErrors} ${errorsTerm}`
  }
  return { errors, summary }
}


/** Get properties about this validation run to log to Mixpanel */
function getLogProps(fileInfo, errorObj) {
  const { errors, summary } = errorObj

  // Avoid needless gotchas in downstream analysis
  let friendlyDelimiter = 'tab'
  if (fileInfo.delimiter === ',') {
    friendlyDelimiter = 'comma'
  } else if (fileInfo.delimiter === ' ') {
    friendlyDelimiter = 'space'
  }

  const defaultProps = {
    ...fileInfo,
    delimiter: friendlyDelimiter,
    numTableCells: fileInfo.numColumns ? fileInfo.numColumns * fileInfo.linesRead : 0
  }

  if (errors.length === 0) {
    return Object.assign({ status: 'success' }, defaultProps)
  } else {
    return Object.assign(defaultProps, {
      status: 'failure',
      summary,
      numErrors: errors.length,
      errors: errors.map(columns => columns[2]),
      errorTypes: errors.map(columns => columns[1])
    })
  }
}

