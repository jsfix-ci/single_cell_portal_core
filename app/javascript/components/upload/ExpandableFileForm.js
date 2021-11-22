import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import Modal from 'react-bootstrap/lib/Modal'
import { Popover, OverlayTrigger } from 'react-bootstrap'

import LoadingSpinner from 'lib/LoadingSpinner'
import FileUploadControl from './FileUploadControl'

/** renders its children inside an expandable form with a header for file selection */
export default function ExpandableFileForm({
  file, allFiles, updateFile, allowedFileExts, validationMessages, bucketName,
  saveFile, deleteFile, isInitiallyExpanded, children
}) {
  const [expanded, setExpanded] = useState(isInitiallyExpanded || file.status === 'new')

  /** handle a click on the header bar (not the expand button itself) */
  function handleDivClick(e) {
    // if the panel is closed, and this didn't come from a link/button, toggle the header expansion
    if (!expanded && !e.target.closest('button') && !e.target.closest('a')) {
      handleExpansionClick()
    }
    // otherwise do nothing
  }

  /** handle a click on the toggle button itself */
  function handleExpansionClick() {
    setExpanded(!expanded)
  }
  let headerClass = 'flexbox-align-center upload-form-header'
  headerClass = expanded ? `${headerClass} expanded` : headerClass

  return <div className="row top-margin">
    <div className="col-md-12">
      <form id={`file-form-${file._id}`}
        className="form-terra"
        onSubmit={e => e.preventDefault()}
        acceptCharset="UTF-8">
        <div className={headerClass} onClick={handleDivClick}>
          <div onClick={handleExpansionClick} className="expander">
            <button type="button" className="btn-icon">
              <FontAwesomeIcon icon={expanded ? faChevronUp : faChevronDown}/>
            </button>
          </div>
          <div className="flexbox">
            <FileUploadControl
              file={file}
              allFiles={allFiles}
              updateFile={updateFile}
              allowedFileExts={allowedFileExts}
              validationMessages={validationMessages}
              bucketName={bucketName}/>
          </div>
          <SaveDeleteButtons {...{ file, updateFile, saveFile, deleteFile, validationMessages }}/>
        </div>
        { expanded && children }
        <SavingOverlay file={file} updateFile={updateFile}/>
      </form>
    </div>
  </div>
}

/** renders an overlay if the file is saving, and also displays server error messages */
export function SavingOverlay({ file, updateFile }) {
  const [showCancelModal, setShowCancelModal] = useState(false)
  const showOverlay = file.isSaving || file.isDeleting
  if (!showOverlay) {
    return <></>
  }
  let cancelButtonContent = <></>
  if (file.cancelUpload) {
    cancelButtonContent = <>
      <button className="btn btn-md terra-secondary-btn upload-cancel-btn"
        data-testid="upload-cancel-btn"
        onClick={() => setShowCancelModal(true)}>
        Cancel
      </button>
      <Modal
        show={showCancelModal}
        onHide={() => setShowCancelModal(false)}
        animation={false}>
        <Modal.Body className="">
          Cancel upload and delete file from the portal?
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-md btn-primary" data-testid="upload-cancel-yes-btn" onClick={() => {
            file.cancelUpload()
            setShowCancelModal(false)
          }}>Yes</button>
          <button className="btn btn-md terra-secondary-btn" onClick={() => {
            setShowCancelModal(false)
          }}>No</button>
        </Modal.Footer>
      </Modal>
    </>
  }
  return <div className="file-upload-overlay" data-testid="file-upload-overlay">
    { cancelButtonContent }
  </div>
}

/** renders save and delete buttons for a given file */
export function SaveDeleteButtons({ file, updateFile, saveFile, deleteFile, validationMessages={} }) {
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false)

  /** delete file with/without confirmation dialog as appropriate */
  function handleDeletePress() {
    if (file.status === 'new') {
      // it hasn't been uploaded yet, just delete it
      deleteFile(file)
    } else {
      setShowConfirmDeleteModal(true)
    }
  }

  const saveDisabled = Object.keys(validationMessages).length > 0
  let saveButton = <button
    style={{ pointerEvents: saveDisabled ? 'none' : 'auto' }}
    type="button"
    className={file.isDirty ? 'btn btn-primary margin-right' : 'btn terra-secondary-btn margin-right'}
    onClick={() => saveFile(file)}
    disabled={saveDisabled}
    data-testid="file-save">
    Save { file.uploadSelection && <span>&amp; Upload</span> }
  </button>

  if (saveDisabled) {
    // if saving is disabled, wrap the disabled button in a popover that will show the errors
    const validationPopup = <Popover id={`save-invalid-${file._id}`} className="tooltip-wide">
      { Object.keys(validationMessages).map(key => <div key={key}>{validationMessages[key]}</div>) }
    </Popover>
    saveButton = <OverlayTrigger trigger={['hover', 'focus']} rootClose placement="top" overlay={validationPopup}>
      <div>{ saveButton }</div>
    </OverlayTrigger>
  } else if (file.isSaving) {
    const savingText = file.saveProgress ? <span>Uploading {file.saveProgress}% </span> : 'Saving'
    saveButton = <button type="button"
      className="btn btn-primary margin-right">
      {savingText} <LoadingSpinner data-testid="file-save-spinner"/>
    </button>
  }

  let deleteButtonContent = 'Delete'
  if (file.isDeleting) {
    deleteButtonContent = <span>Deleting <LoadingSpinner data-testid="file-save-spinner"/></span>
  }

  return <div className="flexbox button-panel">
    { saveButton }
    <button type="button" className="btn terra-secondary-btn" onClick={handleDeletePress} data-testid="file-delete">
      { deleteButtonContent }
    </button>
    <Modal
      show={showConfirmDeleteModal}
      onHide={() => setShowConfirmDeleteModal(false)}
      animation={false}>
      <Modal.Body className="">
        Are you sure you want to delete { file.name }?<br/>
        <span>The file will be removed from the workspace and all corresponding database records deleted.</span>
      </Modal.Body>
      <Modal.Footer>
        <button className="btn btn-md btn-primary" onClick={() => {
          deleteFile(file)
          setShowConfirmDeleteModal(false)
        }}>Delete</button>
        <button className="btn btn-md terra-secondary-btn" onClick={() => {
          setShowConfirmDeleteModal(false)
        }}>Cancel</button>
      </Modal.Footer>
    </Modal>
  </div>
}