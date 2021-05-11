/**
 * @fileoverview Functions for logging performance metrics to Bard / Mixpanel
 */

import { getTTFB, getFCP, getLCP, getFID, getCLS } from 'web-vitals'

import { log } from './metrics-api'

/** Client device memory, # CPUs, and Internet connection speed. */
export const hardwareStats = getHardwareStats()

/**
 * Get data on client device memory, # CPUs, and Internet connection speed.
 *
 * - Effective connection type: https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation
 * - Device memory: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory
 *
 * Adapted from:
 * https://github.com/treosh/web-vitals-reporter/blob/72a807e1df5749896668665d1d28867902ae909d/src/index.js
 */
function getHardwareStats() {
  const nav = (typeof navigator === 'undefined' ? null : navigator)
  const stats = {
    'hardware:memory': nav ? nav.deviceMemory : undefined,
    'hardware:cpus': nav ? nav.hardwareConcurrency : undefined
  }

  const conn = nav && nav.connection ? nav.connection : null
  if (conn) {
    stats['hardware:connection-type'] = conn.effectiveType
    stats['hardware:connection-rtt'] = conn.rtt
    stats['hardware:connection-downlink'] = conn.downlink
  }

  return stats
}

/**
 * Round, source: https://stackoverflow.com/a/18358056
 *
 * @param {number} val
 * @param {number} [precision]
 * @return {number}
 */
function round(val, precision = 0) {
  // @ts-ignore
  return +(`${Math.round(`${val}e+${precision}`)}e-${precision}`)
}

/**
 * Create Web Vitals Bard reporter, that accepts `Metric` values that are logged to Bard.
 *
 * The function is called only once per page load.
 *
 * This is adapted from:
 * https://github.com/treosh/web-vitals-reporter/blob/72a807e1df5749896668665d1d28867902ae909d/src/index.js
 *
 * @return {(metric: Metric) => void}
 */
export function createWebVitalsBardReporter() {
  let isSent = false
  let isCalled = false
  let result = {}

  const sendValues = () => {
    if (isSent) {return} // data is already sent
    if (!isCalled) {return} // no data collected

    result = Object.assign(result, hardwareStats)

    isSent = true

    if (typeof navigator === 'undefined') {return}
    return log('web-vitals', result)
  }

  /** Round metric value as appropriate */
  const mapMetric = function(metric) {
    const isWebVital = ['FCP', 'TTFB', 'LCP', 'CLS', 'FID'].indexOf(metric.name) !== -1
    return { [metric.name]: isWebVital ? round(metric.value, metric.name === 'CLS' ? 4 : 0) : metric.value }
  }

  /** @param {Metric} metric */
  const report = metric => {
    if (!isCalled) {isCalled = true}
    result = { ...result, ...mapMetric(metric, result) }
  }

  // should be the last call to capture latest CLS
  setTimeout(() => {
    // Safari does not fire "visibilitychange" on the tab close
    // So we have 2 options: lose Safari data, or loose LCP/CLS that depends on "visibilitychange" logic.
    // Current solution: if LCP/CLS supported, use `onHidden` otherwise, use `pagehide` to fire the callback in the end.
    //
    // More details: https://github.com/treosh/web-vitals-reporter/issues/3
    const supportedEntryTypes =
      (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes) || []
    const isLatestVisibilityChangeSupported = supportedEntryTypes.indexOf('layout-shift') !== -1

    if (isLatestVisibilityChangeSupported) {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
          sendValues()
          removeEventListener('visibilitychange', onVisibilityChange, true)
        }
      }
      addEventListener('visibilitychange', onVisibilityChange, true)
    } else {
      addEventListener('pagehide', sendValues, { capture: true, once: true })
    }
  })

  return report
}

/**
 * Sets up logging for web vitals and client hardware to Bard / Mixpanel
 *
 * Web vitals are performance metrics for page view UX.
 *
 * Includes:
 *  - TTFB: time to first byte, a very early page load event
 *  - FCP: first contentful paint, when users gets first visual feedback
 *  - LCP: largest contentful paint, a middle measure perceived load time
 *  - FID: first input delay, when user can first interact (e.g. click)
 *  - CLS: cumulative layout shift, measures visual stability
 *  - Hardware stats on connection speed, # CPUs, memory
 *
 * LCP, FID, and CLS are the core web vitals.
 * TTFB and FCP are useful supplements.
 */
export function setupWebVitalsLog() {
  const logWebVitalToBard = createWebVitalsBardReporter()

  getTTFB(logWebVitalToBard)
  getFCP(logWebVitalToBard)
  getLCP(logWebVitalToBard)
  getFID(logWebVitalToBard)
  getCLS(logWebVitalToBard)
}

/** perfTime helper: round all values in an object. */
function roundValues(props) {
  Object.keys(props).forEach(key => {
    props[key] = Math.round(props[key])
  })
  return props
}

/** Calculates generic performance timing metrics for API calls */
export function calculatePerfTimes(perfTimes) {
  const now = performance.now()

  const plot = perfTimes.plot ? perfTimes.plot : 0

  const perfEntry =
    performance.getEntriesByType('resource')
      .filter(entry => entry.name === perfTimes.url)[0]

  const transfer = perfEntry.responseEnd - perfEntry.responseStart

  const frontend = now - perfEntry.responseStart
  const frontendOther = frontend - plot - perfTimes.parse - transfer

  const backend = perfEntry.responseStart - perfEntry.requestStart

  const full = now - perfEntry.startTime

  const legacy = perfTimes.legacyBackend + plot

  const compressedSize = perfEntry.encodedBodySize
  const uncompressedSize = perfEntry.decodedBodySize
  const compressionBytesDiff = uncompressedSize - compressedSize

  const rawPerfProps = {
    // Server + client timing
    'perfTime:full': full, // Time from API call start to effect (e.g. plot) end

    // Less precise, less complete times.  Retained for continuity.
    // Old `perfTime` was measured from API request start to response end,
    // which is very incomplete (lacks client times!) and less precise than
    // using browsers' PerformanceEntry API.
    'perfTime': legacy,
    'perfTime:legacy': legacy,

    // Server timing
    'perfTime:backend': backend, // Time for server to process request

    // Client timing
    'perfTime:frontend': frontend, // Time from API call response start to effect (e.g. plot) end
    'perfTime:frontend:transfer': transfer, // Time client took to download data from server
    'perfTime:frontend:parse': perfTimes.parse, // Time to parse response body (currently only JSON)
    'perfTime:frontend:other': frontendOther, // Total frontend time - accounted segments

    // To answer questions about data sizes and compression
    'perfTime:data:compressed-size': compressedSize, // Encoded response body size in bytes
    'perfTime:data:uncompressed-size': uncompressedSize, // Decoded response body size in bytes
    'perfTime:data:compression-bytes-diff': compressionBytesDiff // Absolute amount compressed
  }

  if (perfTimes.plot) {
    rawPerfProps['perfTime:frontend:plot'] = perfTimes.plot
  }

  // Accounts for `null`, '', 'non-empty string', etc.
  const errorKeys = Object.keys(rawPerfProps).filter(k => isNaN(parseFloat(rawPerfProps[k])))
  if (errorKeys.length > 0) {
    const specifics = errorKeys.map(k => `${k}: ${rawPerfProps[k]}\n`)
    const message = (
      `Not all expected perfTime values are numbers:\n
      ${specifics}`
    )
    console.error(message)
    log('metrics-error', { message })
    return perfTimes // Treat this call to calculatePerfTimes as a no-op
  }

  const perfProps = roundValues(Object.assign({}, rawPerfProps))

  let compressionRatio = uncompressedSize / compressedSize
  // Round to 2 digits, e.g. "3.44".  Number.EPSILON ensures numbers like 1.005 round correctly.
  compressionRatio = Math.round((compressionRatio + Number.EPSILON) * 100) / 100
  perfProps['perfTime:data:compression-ratio'] = compressionRatio // Relative amount compressed

  perfProps['perfTime:url'] = perfTimes.url

  return perfProps
}

/** Merges generic perfTime props and hardware stats into logged properties */
export function addPerfMetrics(props) {
  const perfTimes = calculatePerfTimes(props.perfTimes)
  props = Object.assign(props, hardwareStats, perfTimes)
  return props
}