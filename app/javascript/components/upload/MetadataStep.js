import React, { useEffect, useContext } from 'react'
import metadataExplainerImage from 'images/metadata-convention-explainer.jpg'
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Popover, OverlayTrigger } from 'react-bootstrap'
import FileDownloadControl from 'components/download/FileDownloadControl'


import { UserContext } from 'providers/UserProvider'
import FileUploadControl, { FileTypeExtensions } from './FileUploadControl'
import { TextFormField, SavingOverlay, SaveDeleteButtons } from './uploadUtils'

const DEFAULT_NEW_METADATA_FILE = {
  file_type: 'Metadata',
  use_metadata_convention: true
}

const metadataFileFilter = file => file.file_type === 'Metadata'

export default {
  title: 'Metadata',
  name: 'metadata',
  component: MetadataForm,
  fileFilter: metadataFileFilter
}

/** Renders a form for uploading one or more cluster/spatial files */
function MetadataForm({
  serverState,
  formState,
  addNewFile,
  updateFile,
  saveFile,
  deleteFile,
  handleSaveResponse
}) {
  const userState = useContext(UserContext)
  const featureFlagState = userState.featureFlagsWithDefaults
  const conventionRequired = featureFlagState && featureFlagState.convention_required

  const file = formState.files.find(metadataFileFilter)

  useEffect(() => {
    if (!file) {
      addNewFile(DEFAULT_NEW_METADATA_FILE)
    }
  }, [file?._id])

  return <div>
    <div className="row">
      <div className="col-md-12">
        <h4>Metadata</h4>
      </div>
    </div>
    <div className="row">
      <div className="col-md-12">
        <div className="form-terra">
          <div className="row">
            <div className="col-md-12" id="metadata-convention-explainer">
              A <b>metadata file</b> lists all cells in the study
              <img src={metadataExplainerImage}/>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <a id="metadata-convention-example-link"
                href="https://singlecell.zendesk.com/hc/en-us/articles/360060609852-Required-Metadata"
                target="_blank" rel="noopener noreferrer">
                View required conventional metadata
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    { file &&
      <div className="row top-margin" key={file._id}>
        <div className="col-md-12 ">
          <form id={`metadataForm-${file._id}`}
            className="form-terra"
            acceptCharset="UTF-8"
            onSubmit={() => {return false}}>
            <div className="row">
              <div className="col-md-12 flexbox-align-center">
                <FileUploadControl
                  handleSaveResponse={handleSaveResponse}
                  file={file}
                  updateFile={updateFile}
                  allowedFileTypes={FileTypeExtensions.plainText}/>
                <FileDownloadControl
                  file={file}
                  bucketName={formState.study.bucket_id}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Do you use SCP conventional names for required metadata column headers? </label>
              <OverlayTrigger trigger="click" rootClose placement="top" overlay={whyConventionPopover}>
                <span> <FontAwesomeIcon data-analytics-name="metadata-convention-popover"
                  className="action log-click help-icon" icon={faInfoCircle}/></span>
              </OverlayTrigger><br/>
              <label className="sublabel">
                <input type="radio"
                  name={`metadataFormYes-${file._id}`}
                  value="true"
                  disabled={conventionRequired}
                  checked={file.use_metadata_convention}
                  onChange={e => updateFile(file._id, { use_metadata_convention: true })} /> Yes
              </label>
              <label className="sublabel">
                <input type="radio"
                  name={`metadataFormNo-${file._id}`}
                  value="false"
                  disabled={conventionRequired}
                  checked={!file.use_metadata_convention}
                  onChange={e => updateFile(file._id, { use_metadata_convention: false })} /> No
              </label> &nbsp; &nbsp;
              <OverlayTrigger trigger="click"
                rootClose
                placement="top"
                overlay={<ConventionIssuePopover studyAccession={serverState.study.accession} email={userState.email}/>}>
                <span className="action log-click"> Using conventional names is an issue for my study</span>
              </OverlayTrigger><br/>
              Learn <a href="https://singlecell.zendesk.com/hc/en-us/articles/360061006411-Metadata-Convention"
                target="_blank"
                rel="noopener noreferrer">how to convert your file.</a><br/>
              If the file fails metadata convention validation, you will be emailed messages to help correct it.
            </div>
            <div className="form-group">
              <TextFormField label="Name" fieldName="name" file={file} updateFile={updateFile}/>
            </div>
            <div className="form-group">
              <TextFormField label="Description" fieldName="description" file={file} updateFile={updateFile}/>
            </div>
            <SaveDeleteButtons file={file} updateFile={updateFile} saveFile={saveFile} deleteFile={deleteFile}/>
          </form>
          <SavingOverlay file={file} updateFile={updateFile}/>
        </div>
      </div>
    }
  </div>
}

const whyConventionPopover = (
  <Popover id="why-use-convention">
    Why use the metadata convention?<br/>
    Using the metadata convention will enable your data to be discovered through our faceted search interface.
    Using the convention means extra validation will be applied to ensure your metadata conforms to standard vocabularies.<br/>
    <a href='https://singlecell.zendesk.com/hc/en-us/articles/360061006411-Metadata-Convention' target='_blank' rel="noopener noreferrer">Learn more</a>.
  </Popover>
)


/** Popover with the zendesk form url so that the user's info is prepopulated */
function ConventionIssuePopover({ email, studyAccession, ...props }) {
  /** return the zendesk form url so that the user's info is prepopulated */
  const formUrl= `https://singlecell.zendesk.com/hc/en-us/requests/new?ticket_form_id=1260811597230
&tf_1260822624790=${studyAccession}&tf_anonymous_requester_email=${email}
&tf_1900002173444=metadata_convention_exemption&tf_subject=
Metadata%20Convention%20Exemption%20Request%20for%20${studyAccession}`
  return <Popover id="convention-issues" {...props}>
    Using the convention is now required.  If this presents a particular issue for your study,
    please use this <a href={formUrl} target="_blank" rel="noopener noreferrer">contact form </a>
    &nbsp;so we can assist you with your metadata.
  </Popover>
}

