import React from 'react'
import { fetchBucketFile } from 'lib/scp-api'
import { bytesToSize } from 'lib/stats'

/** renders a file download control for the given file object */
export default function FileDownloadControl({ file, bucketName }) {
  const fileName = file.upload_file_name

  /** Load file when button is clicked */
  const handleOnClick = () => {
    getBucketLocalUrl(bucketName, fileName).then(value => window.location = value)
  }

  /** get the remote file path */
  async function getBucketLocalUrl() {
    const response = await fetchBucketFile(bucketName, fileName)
    const fileBlob = await response.blob()
    return URL.createObjectURL(fileBlob)
  }

  if (!file.upload_file_name) {
    return null
  } else {
    if (!file.upload_file_name && file.human_data) {
      return null
    // TODO once the Sequence Data tab is added update this section for handling external human data files
    } else {
      return <p>
        <br></br>
        {!file.generation ? <span className="label label-warning no-download-available" data-toggle="tooltip"
          title='You will be able to download this file once it has been uploaded to our remote data store. Check back soon.'>
          {<span className="fas fa-ban"></span> } Awaiting remote file
        </span> :
          <a onClick={() => handleOnClick()} >
            {<span className="fas fa-download"></span> } {bytesToSize(file.upload_file_size)}
          </a>
        }

      </p>
    }
  }
}
