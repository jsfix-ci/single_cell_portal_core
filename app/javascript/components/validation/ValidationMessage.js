import React from 'react'
import ReactDOM from 'react-dom'
import { supportEmailLink } from 'lib/error-utils'
import _capitalize from 'lodash/capitalize'
import pluralize from 'pluralize'

/** Help users get reach us for support */
function SupportMessage({ studyAccession }) {
  return (
    <div>
    Need help? Email us at {supportEmailLink} with the errors,
    your study accession ({studyAccession}),
    and a description or attachment of your file.
    </div>
  )
}

const refresh =
  <a href="" data-analytics-name="sync-validation-refresh">
    Refresh the page
  </a>

/** Summarize errors and warnings */
function Summary({ msgs, issueCategory, fileName=null, showRefreshLink=false }) {
  // E.g. "Errors", "Warning"
  const issueTxt = pluralize(_capitalize(issueCategory), msgs.length)

  if (issueCategory === 'error') {
    const redo = showRefreshLink ? refresh : 'Re-choose the file'
    return <p>{issueTxt} found.  {redo} after correcting {fileName}.</p>
  } else {
    return <p>{issueTxt}:</p>
  }
}

function SyncSuggestion() {

}

/**
 * Show result of file validation issue for upload UI or sync UI
 */
export default function ValidationMessage({
  studyAccession, errorMsgs, warningMsgs, fileName, showRefreshLink=false
}) {
  return (
    <>
      { errorMsgs?.length > 0 &&
      <div className="validation-error" data-testid="validation-error">
        <Summary msgs={errorMsgs} issueCategory='error' fileName={fileName} showRefreshLink={showRefreshLink} />
        <ul>{errorMsgs.map((msg, i) => {
          return <li className="validation-error" key={i}>{msg}</li>
        })}
        </ul>
        <SupportMessage studyAccession={studyAccession} />
        <br/>
      </div>
      }
      { warningMsgs?.length > 0 &&
      <div className="validation-warning" data-testid="validation-warning">
        <Summary msgs={warningMsgs} issueCategory='warning' />
        <ul>{ warningMsgs.map((msg, index) => {
          return <li className="validation-warning" key={index}>{msg}</li>
        })}</ul>
      </div>
      }
    </>
  )
}

/** Convenience function to render this in a non-React part of the app */
export function renderValidationMessage(
  target, studyAccession, errorMsgs, warningMsgs, fileName, showRefreshLink
) {
  ReactDOM.unmountComponentAtNode(target)
  ReactDOM.render(
    <ValidationMessage
      studyAccession={studyAccession}
      errorMsgs={errorMsgs}
      warningMsgs={warningMsgs}
      fileName={fileName}
      showRefreshLink={showRefreshLink}
    />,
    target
  )
}
