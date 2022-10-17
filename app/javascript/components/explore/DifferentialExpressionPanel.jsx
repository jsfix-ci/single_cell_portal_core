
import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faInfoCircle } from '@fortawesome/free-solid-svg-icons'

import DifferentialExpressionGroupPicker from '~/components/visualization/controls/DifferentialExpressionGroupPicker'
import { logSearchFromDifferentialExpression } from '~/lib/search-metrics'

/** Return selected annotation object, including its `values` a.k.a. groups */
function getAnnotationObject(exploreParamsWithDefaults, exploreInfo) {
  const selectedAnnotation = exploreParamsWithDefaults?.annotation
  return exploreInfo.annotationList.annotations.find(thisAnnotation => {
    return (
      thisAnnotation.name === selectedAnnotation.name &&
      thisAnnotation.type === selectedAnnotation.type &&
      thisAnnotation.scope === selectedAnnotation.scope
    )
  })
}

/** Set up radio buttons to be all unchecked upon changing dropdown value */
function initChecked(deGenes, checkedGene) {
  const checked = {}
  if (!deGenes) {return checked}
  deGenes.forEach(deGene => {
    checked[deGene.name] = checkedGene && checkedGene === deGene.name
  })
  return checked
}

/** Differential expression panel shown at right in Explore tab */
export default function DifferentialExpressionPanel({
  deGroup, deGenes, searchGenes,
  exploreInfo, exploreParamsWithDefaults, setShowDeGroupPicker, setDeGenes, setDeGroup,
  countsByLabel
}) {
  const clusterName = exploreParamsWithDefaults?.cluster
  const bucketId = exploreInfo?.bucketId
  const annotation = getAnnotationObject(exploreParamsWithDefaults, exploreInfo)
  const deObjects = exploreInfo?.differentialExpression

  const [checked, setChecked] = useState(initChecked(deGenes))
  const [deFileUrl, setDeFileUrl] = useState(null)

  /** Check radio button such that changing group unchecks all buttons */
  function changeRadio(event) {
    const newChecked = initChecked(deGenes, event.target.value)
    setChecked(newChecked)
  }

  return (
    <>
      <DifferentialExpressionGroupPicker
        bucketId={bucketId}
        clusterName={clusterName}
        annotation={annotation}
        setShowDeGroupPicker={setShowDeGroupPicker}
        deGenes={deGenes}
        setDeGenes={setDeGenes}
        deGroup={deGroup}
        setDeGroup={setDeGroup}
        setDeFileUrl={setDeFileUrl}
        countsByLabel={countsByLabel}
        deObjects={deObjects}
      />

      {deGenes &&
      <>
        15 most DE genes
        <span className="pull-right">
          {/* <a href={deFileUrl}
            target="_blank"
            data-analytics-name="differential-expression-download"
            data-toggle="tooltip"
            data-original-title="Download all DE genes data for this group"
          >
            <FontAwesomeIcon icon={faDownload}/></a> */}
          <a href="https://singlecell.zendesk.com/hc/en-us/articles/6059411840027"
            target="_blank"
            data-analytics-name="differential-expression-docs"
            // style={{ 'marginLeft': '10px' }} // Dev placeholder for when download is enable
            data-toggle="tooltip"
            data-original-title="Learn about SCP DE genes analysis"
          >
            <FontAwesomeIcon
              className="action help-icon" icon={faInfoCircle}
            />
          </a>
        </span>
        <table data-testid="differential-expression-table" className="table table-terra table-scp-compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>
                <span className="glossary" data-toggle="tooltip" data-original-title="Log (base 2) of fold change">
                  log<sub>2</sub>(FC)
                </span>
              </th>
              <th>
                <span className="glossary" data-toggle="tooltip" data-original-title="p-value adjusted with Benjamini-Hochberg FDR correction">
                  Adj. p-value
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {deGenes.map((deGene, i) => {
              return (
                <tr key={i}>
                  <td>
                    <label
                      title="Click to view gene expression.  Arrow down (↓) and up (↑) to quickly scan."
                    ><input
                        type="radio"
                        checked={checked[deGene.name]}
                        data-analytics-name="selected-gene-differential-expression"
                        value={deGene.name}
                        onClick={event => {
                          searchGenes([deGene.name])

                          // Log this search to Mixpanel
                          const speciesList = exploreInfo?.taxonNames
                          const rank = i
                          logSearchFromDifferentialExpression(
                            event, deGene, speciesList, rank,
                            clusterName, annotation.name
                          )

                          changeRadio(event)
                        }}/>
                      {deGene.name}</label></td>
                  <td>{deGene.log2FoldChange}</td>
                  <td>{deGene.pvalAdj}</td>
                </tr>)
            })}
          </tbody>
        </table>
        <a href="https://forms.gle/qPGH5J9oFkurpbD76" target="_blank" title="Take a 1 minute survey">
          Help improve this new feature
        </a>
      </>
      }
    </>
  )
}

/** Top matter for differential expression panel shown at right in Explore tab */
export function DifferentialExpressionPanelHeader({
  setDeGenes, setDeGroup, setShowDifferentialExpressionPanel
}) {
  return (
    <>
      <span>Differentially expressed genes</span>
      <button className="action fa-lg"
        onClick={() => {
          setDeGenes(null)
          setDeGroup(null)
          setShowDifferentialExpressionPanel(false)
        }}
        title="Exit differential expression panel"
        data-analytics-name="differential-expression-panel-exit">
        <FontAwesomeIcon icon={faArrowLeft}/>
      </button>
    </>
  )
}
