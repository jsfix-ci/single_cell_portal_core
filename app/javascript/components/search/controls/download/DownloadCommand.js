import React, { useState, useEffect, useRef } from 'react'

import LoadingSpinner from 'lib/LoadingSpinner'
import { fetchAuthCode, stringifyQuery } from 'lib/scp-api'
import { _ as bardUtils } from '@databiosphere/bard-client/src/utils'

/** component for rendering a copyable bulk download command for an array of file ids.
    Queries the server to retrieve the appropriate auth code. */
export default function DownloadCommand({ fileIds=[], azulFiles }) {
  const [isLoading, setIsLoading] = useState(true)
  const [authInfo, setAuthInfo] = useState({ authCode: null, timeInterval: 3000 })
  const [refreshNum, setRefreshNum] = useState(0)
  const textInputRef = useRef(null)

  /** Copy download command to user's system clipboard */
  function copyToClipboard(event) {
    textInputRef.current.select()
    document.execCommand('copy')
    event.target.focus()
  }

  useEffect(() => {
    setIsLoading(true)
    fetchAuthCode(fileIds, azulFiles).then(result => {
      setAuthInfo(result)
      setIsLoading(false)
    })
  }, [refreshNum])

  const downloadCommand = getDownloadCommand(authInfo.authCode, authInfo.downloadId)

  return <div className="download-url-modal row">
    <br/><br/><br/>
    {
      isLoading &&
      <div className="text-center">
        Authorizing<br/>
        <LoadingSpinner data-testid="bulk-download-loading-icon"/>
      </div>
    }
    {
      !isLoading &&
      <div className="col-md-12">
        <h4>Copy the command below and paste it into your Mac/Linux/Unix terminal</h4>
        This command is valid for one use within <span className='countdown'>
          {Math.floor(authInfo.timeInterval / 60)}
        </span> minutes.
        <div className='input-group'>
          <input
            ref={textInputRef}
            className='form-control curl-download-command'
            value={downloadCommand || ''}
            readOnly
          />
          <span className='input-group-btn'>
            <button
              className='btn btn-default btn-copy'
              onClick={copyToClipboard}
              data-analytics-name='download-command-copy'
              data-toggle='tooltip'
              title='Copy to clipboard'
            >
              <i className='far fa-copy'></i>
            </button>
            <button
              className='download-refresh-button btn btn-default btn-refresh glyphicon glyphicon-refresh' // eslint-disable-line max-len
              data-analytics-name='download-command-refresh'
              data-toggle='tooltip'
              title='Refresh download command'
              onClick={() => setRefreshNum(refreshNum + 1)}
            >
            </button>
          </span>
        </div>
      </div>
    }
  </div>
}

/**
 * Create auth code, build download command, return configuration object
 *
 * @returns {Object} Object for auth code, time interval, and download command
 */
function getDownloadCommand(authCode, downloadId) {
  // Get client os and determine correct curl invocation
  const clientOS = bardUtils.info.os()
  const curlExec = clientOS.match(/Win/) ? 'curl.exe' : 'curl'
  const queryParams = {
    auth_code: authCode,
    download_id: downloadId,
    context: 'global' // this is a search-based bulk download request
  }
  const queryString = stringifyQuery(queryParams)

  // Gets a curl configuration ("cfg.txt") containing signed
  // URLs and output names for all files in the download object.
  const baseUrl = `${window.origin}/single_cell/api/v1`
  const url = `${baseUrl}/bulk_download/generate_curl_config${queryString}`

  // "-k" === "--insecure"
  let curlSecureFlag = ''
  if (('SCP' in window) && window.location.hostname === 'localhost') {
    curlSecureFlag = 'k'
  }

  // This is what the user will run in their terminal to download the data.
  // To consider: check the node environment (either at compile or runtime)
  // instead of the hostname
  const downloadCommand = (
    `${curlExec} "${url}" -${curlSecureFlag}o cfg.txt; ` +
    `${curlExec} -K cfg.txt; rm cfg.txt` // Removes only if curl succeeds
  )

  return downloadCommand
}
