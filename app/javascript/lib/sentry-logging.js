/**
 * @fileoverview Functions for logging JS errors to Sentry
 *
 */
 import * as Sentry from '@sentry/react'
 import { BrowserTracing } from '@sentry/tracing'
 import getSCPContext from '~/providers/SCPContextProvider'

/**
 * Log an exception to Sentry for bad response JS fetch executions
 * e.g. requests that result in a 404 response
 *
 * @param {Object} response - the response object from a failed JS fetch call
 * @param {String} titleInfo - extra info for the title of the Sentry event
 */
export function logJSFetchExceptionToSentry(response, titleInfo = '') {
  // add details from the response to the 'response info' object that will be logged in Sentry
  Sentry.setContext('response info', {
    status: response.status,
    statusText: response.statusText,
    url: response.url
  })

  shouldLog() && Sentry.captureException(new Error(`${response.status}: ${titleInfo}`))
}

/**
 * Log an exception to Sentry for failed JS fetch executions
 * i.e. fetches that fail and error
 *
 * @param {Object} response - the response object from a failed JS fetch call
 * @param {String} titleInfo - extra info for the title of the Sentry event
 */
export function logJSFetchErrorToSentry(error, titleInfo = '') {
  shouldLog() && Sentry.captureException(new Error(`${error}: ${titleInfo}`))
}

/**
 * Determine if logging should occur based on environment
 */
function shouldLog() {
  const env = getSCPContext().environment

  // do not log for development or test environments
  // to test locally comment out lines 45-47
  if (['development', 'test'].includes(env)) {
    return false
  }

  return true
}

/**
 *  Initialize Sentry to enable logging JS errors to Sentry
 */
export function setupSentry() {
  Sentry.init({
    dsn: 'https://a713dcf8bbce4a26aa1fe3bf19008d26@o54426.ingest.sentry.io/1424198',
    integrations: [new BrowserTracing()],

    // send 100% of the transactions to Sentry since they will only occur on errors
    // TODO: SCP-4335 to limit transactions appropriately
    tracesSampleRate: 1.0
  })

  // set the logger tag to reflect that the errors are from the frontend
  Sentry.setTag('logger', 'app-frontend')

  // set the scope for Sentry to the current environment
  Sentry.configureScope(scope =>
    scope.addEventProcessor(
      event =>
        new Promise(resolve =>
          resolve({
            ...event,
            environment: getSCPContext().environment
          })
        )
    )
  )
}