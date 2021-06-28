import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDna, faInfoCircle } from '@fortawesome/free-solid-svg-icons'
import _cloneDeep from 'lodash/cloneDeep'

/** component that renders a list of studies so that individual studies/files can be selected
  * @param {Object} downloadInfo study download information as provided by fetchDownloadInfo from scp-api.
  * @param {Boolean} isLoading whether the call to fetchDownloadInfo is still loading
  * @param {Object} selectedBoxes. The current state of the checkboxes for selecting files/studies
  *   see newSelectedBoxesState for an explanation of structure
  * @param {function} setSelectedBoxes function for updating the selectedBoxes state
  */
export default function DownloadSelectionTable({ downloadInfo, isLoading, selectedBoxes, setSelectedBoxes }) {
  /** update a single checkbox value, and handles updating any connected checkboxes in the table
    * for example, if you update the value of the 'all metadata' checkbox, this checks all the individual
    * study checkboxes.  Likewise, clicking a study checkbox will select/deselect the 'all' checkboxes as appropriate
    * @param {Boolean} value the new checkbox value
    * @param {Boolean} isAllStudies whether the checkbox is the top 'all' row
    * @param {String} column one of 'matrix', 'metadata', 'cluster', 'all'
    * @param {Integer} index the row index of the checkbox (ignored if isAllStudies is true)
    */
  function updateSelection(value, isAllStudies, column, index) {
    const updatedSelection = _cloneDeep(selectedBoxes)
    let colsToUpdate = [column]
    if (column === 'all') {
      colsToUpdate = COLUMN_ORDER_WITH_ALL
    }
    if (isAllStudies) {
      colsToUpdate.forEach(colType => updatedSelection.all[colType] = value)
      updatedSelection.studies.forEach(studySelection => {
        colsToUpdate.forEach(colType => studySelection[colType] = value)
      })
    } else {
      colsToUpdate.forEach(colType => updatedSelection.studies[index][colType] = value)
    }
    // update the study select-all checkboxes given their selection
    updatedSelection.studies.forEach(studySelection => {
      const rowValues = COLUMN_ORDER.map(colType => studySelection[colType])
      studySelection.all = rowValues.every(val => !!val)
    })
    // update the top row select-all checkboxes given their selection
    COLUMN_ORDER_WITH_ALL.forEach(colType => {
      const columnValues = updatedSelection.studies.map(studySelection => studySelection[colType])
      updatedSelection.all[colType] = columnValues.every(val => !!val)
    })
    setSelectedBoxes(updatedSelection)
  }

  return (
    <div className="download-table-container">
      {
        isLoading &&
        <div className="text-center greyed">
          Loading file information<br/>
          <FontAwesomeIcon
            icon={faDna}
            data-testid="bulk-download-loading-icon"
            className="gene-load-spinner"
          />
        </div>
      }
      {
        !isLoading &&
        <table className="table table-terra">
          <thead>
            <tr>
              <td>
                <label>
                  <input type="checkbox"
                    data-analytics-name="download-modal-checkbox"
                    onChange={e => updateSelection(e.target.checked, true, 'all')}
                    checked={selectedBoxes.all['all']}>
                  </input>
                </label>
              </td>
              <td width="40%">
                Study name
              </td>
              { COLUMN_ORDER.map(colType => {
                return <td key={colType}>
                  <label>
                    <input type="checkbox"
                      data-analytics-name="download-modal-checkbox"
                      onChange={e => updateSelection(e.target.checked, true, colType)}
                      checked={selectedBoxes.all[colType]}>
                    </input>
                    &nbsp;
                    { COLUMNS[colType].title }
                  </label>
                  &nbsp;
                  <FontAwesomeIcon data-analytics-name="download-modal-column-info"
                    data-toggle="tooltip"
                    data-original-title={COLUMNS[colType].info}
                    className="action log-click help-icon"
                    icon={faInfoCircle} />
                </td>
              })}
            </tr>
          </thead>
          <tbody>
            { downloadInfo.map((study, index) => {
              return <tr key={study.accession}>
                <td>
                  <label>
                    <input type="checkbox"
                      data-analytics-name="download-modal-checkbox"
                      onChange={e => updateSelection(e.target.checked, false, 'all', index)}
                      checked={selectedBoxes.studies[index].all}>
                    </input>
                  </label>
                </td>
                <td width="40%">
                  { study.name }
                </td>
                { COLUMN_ORDER.map(colType => {
                  return <td key={colType}>
                    <StudyFileCheckbox
                      study={study}
                      studyIndex={index}
                      colType={colType}
                      selectedBoxes={selectedBoxes}
                      updateSelection={updateSelection}/>
                  </td>
                })}
              </tr>
            })}
          </tbody>
        </table>
      }
    </div>
  )
}

const NEW_ROW_STATE = { all: true, matrix: true, metadata: true, cluster: true }
const COLUMN_ORDER = ['matrix', 'metadata', 'cluster']
const COLUMN_ORDER_WITH_ALL = ['all', ...COLUMN_ORDER]
const COLUMNS = {
  matrix: {
    title: 'Matrix',
    types: ['Expression Matrix', 'MM Coordinate Matrix', '10X Genes File', '10X Barcodes File'],
    info: 'Expression matrix files, including processed or raw counts files'
  },
  cluster: {
    title: 'Clustering',
    types: ['Cluster'],
    info: 'Clustering coordinate files, including 2D and 3D clustering, as well as spatial'
  },
  metadata: {
    title: 'Metadata',
    types: ['Metadata'],
    info: 'The listing of all cells in the study, along with associated metadata such as species, cell type, etc...'
  }
}

/** component for rendering a study file checkbox, along with the size of the files
  * @param {Object} study the study object from the downloadInfo object
  * @param {Integer} studyIndex the index of the study in the selectedBoxes/downloadInfo array
  * @param {String} colType  'matrix', 'metadata', or 'cluster'
  * @param {Function} updateSelection function for updating the checkbox state
  */
function StudyFileCheckbox({ study, studyIndex, selectedBoxes, colType, updateSelection }) {
  const { fileCount, fileSize } = getFileStats(study, COLUMNS[colType].types)
  if (fileCount === 0) {
    return <span className="detail">none</span>
  }
  return <label>
    <input type="checkbox"
      data-analytics-name="download-modal-checkbox"
      onChange={e => updateSelection(e.target.checked, false, colType, studyIndex)}
      checked={selectedBoxes.studies[studyIndex][colType]}>
    </input>
    &nbsp;
    {fileCount} files {bytesToSize(fileSize)}
  </label>
}

/** Gets a selectedBoxes state from a downloadInfo object.
  * will contain a 'studies' property with an array with one entry per study
  *
  * { all: {all: true, matrix: true, metadata: true, cluster: true},
  *   studies: [
  *      {all: true, matrix: true, metadata: true, cluster: true}
  *      ...
  *    ]
  *  }
  */
export function newSelectedBoxesState(downloadInfo) {
  return {
    all: { ...NEW_ROW_STATE },
    studies: downloadInfo.map(study => ({ ...NEW_ROW_STATE }))
  }
}

/** Gets the number of files and bytes for the given downloadInfo, given the selection state
  */
export function getSelectedFileStats(downloadInfo, selectedBoxes, isLoading) {
  let totalFileCount = 0
  let totalFileSize = 0
  if (!isLoading) {
    downloadInfo.forEach((study, index) => {
      COLUMN_ORDER.forEach(colType => {
        if (selectedBoxes.studies[index][colType]) {
          const { fileCount, fileSize } = getFileStats(study, COLUMNS[colType].types)
          totalFileCount += fileCount
          totalFileSize += fileSize
        }
      })
    })
  }
  return { fileCount: totalFileCount, fileSize: totalFileSize }
}


/** for a given study and file type, get the number of files and bytes for download
  * @param {Object} study study object from downloadInfo (from scp-api fetchDownloadInfo)
  * @param {Array} fileTypes array of zero or more of 'matrix', 'metadata', 'cluster'
  */
export function getFileStats(study, fileTypes) {
  const files = study.studyFiles.filter(file => fileTypes.includes(file.file_type))
  const fileCount = files.length
  const fileSize = files.reduce((sum, studyFile) => sum + studyFile.upload_file_size, 0)
  return { fileCount, fileSize }
}

/** Gets the file ids selected, given downloadInfo and the current selection state
  */
export function getSelectedFileIds(downloadInfo, selectedBoxes) {
  const fileIds = []
  downloadInfo.forEach((study, index) => {
    COLUMN_ORDER.forEach(colType => {
      if (selectedBoxes.studies[index][colType]) {
        const filesOfType = study.studyFiles.filter(file => COLUMNS[colType].types.includes(file.file_type))
        fileIds.push(...filesOfType.map(file => file.id))
      }
    })
  })
  return fileIds
}

/**
 * Format number in bytes, with human-friendly units
 *
 * Derived from https://gist.github.com/lanqy/5193417#gistcomment-2663632
 */
export function bytesToSize(bytes) {
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) {return 'n/a'}

  // eweitz: Most implementations use log(1024), but such units are
  // binary and have values like MiB (mebibyte)
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1000)), 10)

  if (i === 0) {return `${bytes} ${sizes[i]}`}
  return `${(bytes / (1000 ** i)).toFixed(1)} ${sizes[i]}`
}