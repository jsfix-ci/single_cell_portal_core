import React, { useEffect, useState } from 'react'
import _uniqueId from 'lodash/uniqueId'
import Plotly from 'plotly.js-dist'

import { fetchStudyUsage } from '~/lib/scp-api'
import LoadingSpinner from '~/lib/LoadingSpinner'
import { supportEmailLink } from '~/lib/error-utils'
import InfoPopup from '~/lib/InfoPopup'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons'

/** display mixpanel stats for a given study */
export default function StudyUsageInfo({ study }) {
  const [usageInfo, setUsageInfo] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showTable, setShowTable] = useState(false)
  const [viewsGraphElementId] = useState(_uniqueId('study-usage-graph-'))
  const [downloadsGraphElementId] = useState(_uniqueId('study-usage-graph-'))
  const studyAccession = study.accession

  /** get the usage information via API call */
  useEffect(() => {
    fetchStudyUsage(study.accession).then(response => {
      setUsageInfo(response)
      setIsLoading(false)
    })
    window.document.title = `Study usage - Single Cell Portal`

  }, [study.accession])

  const tableData = []

  if (usageInfo) {
    // generate the trace information and table information
    const viewData = usageInfo.pageViews.data
    const viewsTrace = {
      type: 'bar',
      x: viewData.series,
      y: viewData.series.map(x => {
        return viewData.values[x] ? viewData.values[x] : 0
      })
    }
    const viewsLayout = {
      xaxis: { title: 'Month' },
      yaxis: { title: 'Unique users' }
    }
    Plotly.react(viewsGraphElementId, [viewsTrace], viewsLayout)
    tableData.push(viewsTrace.x)
    tableData.push(viewsTrace.y)

    // sum together the single file clicks and the bulk downloads for the graph
    const downloadData = usageInfo.fileDownloads.data
    const downloadTableData = []
    const bulkDownloadData = usageInfo.bulkDownloads.data
    const bulkDownloadTableData = []
    const downloadsTrace = {
      type: 'bar',
      x: downloadData.series,
      y: downloadData.series.map(x => {
        const singleFileDownloads = downloadData.values[x] ? downloadData.values[x] : 0
        downloadTableData.push(singleFileDownloads)
        const bulkFileDownloads = bulkDownloadData.values[x] ? bulkDownloadData.values[x] : 0
        bulkDownloadTableData.push(bulkFileDownloads)
        return singleFileDownloads + bulkFileDownloads
      })
    }
    const downloadsLayout = {
      xaxis: { title: 'Month' },
      yaxis: { title: 'Download events' }
    }
    Plotly.react(downloadsGraphElementId, [downloadsTrace], downloadsLayout)
    tableData.push(downloadTableData)
    tableData.push(bulkDownloadTableData)
  }

  return <div>
    <h3>Study statistics</h3>
    {studyAccession}: <a href={`/single_cell/study/${studyAccession}`}>{ study.name }</a><br/>
    <div className="text-center">
      Users per month who viewed this study. <InfoPopup content="Unique users per month visiting the study overview page (i.e. each user only counts at most once per month)"/><br/>
      <LoadingSpinner isLoading={isLoading} testId="study-usage-spinner"/>
    </div>
    <div
      className="scatter-graph"
      id={viewsGraphElementId}
      data-testid={viewsGraphElementId}
    ></div>
    <br/><br/>
    <div className="text-center">
      File download events <InfoPopup content="Clicks on a single file-download button, or a bulk download that included this study"/><br/>
      <LoadingSpinner isLoading={isLoading}/>
    </div>
    <div
      className="scatter-graph"
      id={downloadsGraphElementId}
      data-testid={viewsGraphElementId}
    ></div>
    <br/><br/>
    <div className="form-terra">
      <h5 onClick={() => setShowTable(!showTable)}>
        <span className="action">
          { showTable ? <FontAwesomeIcon icon={faChevronUp}/> : <FontAwesomeIcon icon={faChevronDown}/> }
        </span> Tabular Data
      </h5>
      { !isLoading && showTable && <table className="table-terra compressed">
        <thead>
          <tr>
            <td>Month</td>
            <td>Views</td>
            <td>Single file downloads</td>
            <td>Bulk downloads</td>
          </tr>
        </thead>
        <tbody>
          { transpose(tableData).map((row, i) => (
            <tr key={i}>
              { row.map((d, i2) => <td key={i2}>{d}</td>) }
            </tr>
          ))}
        </tbody>
      </table> }
    </div> <br/>
    <div className="text-center">
      If you would like more information about views, downloads, or other statistics for your study, contact us at { supportEmailLink }
    </div>
  </div>
}
/** transpose an array of arrays */
function transpose(matrix) {
  return matrix[0].map((col, i) => matrix.map(row => row[i]))
}
