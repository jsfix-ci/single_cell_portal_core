import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { Router, navigate, useLocation } from '@reach/router'
import * as queryString from 'query-string'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCaretLeft, faCaretRight, faLink } from '@fortawesome/free-solid-svg-icons'
import _clone from 'lodash/clone'

import ClusterControls from 'components/visualization/ClusterControls'
import SpatialSelector from './SpatialSelector'
import CreateAnnotation from './CreateAnnotation'
import PlotDisplayControls, { defaultRenderParams } from 'components/visualization/PlotDisplayControls'
import ExploreDisplayTabs from './ExploreDisplayTabs'
import { stringifyQuery, fetchExplore, geneParamToArray, geneArrayToParam } from 'lib/scp-api'
import { getDefaultClusterParams, getIdentifierForAnnotation } from 'lib/cluster-utils'
import { DEFAULT_ROW_CENTERING } from 'components/visualization/Heatmap'

/** converts query string parameters into the dataParams objet */
function buildDataParamsFromQuery(query) {
  const dataParams = {
    userSpecified: {}
  }
  const queryParams = queryString.parse(query)
  let annotation = {
    name: '',
    scope: '',
    type: ''
  }
  if (queryParams.annotation) {
    const [name, type, scope] = queryParams.annotation.split('--')
    annotation = { name, type, scope }
    if (name && name.length > 0) {
      dataParams.userSpecified.annotation = true
    }
  }

  const paramList = ['cluster', 'subsample', 'consensus', 'spatialGroups', 'genes', 'tab']
  paramList.forEach(param => {
    if (queryParams[param] && queryParams[param].length) {
      dataParams.userSpecified[param] = true
    }
  })
  dataParams.cluster = queryParams.cluster ? queryParams.cluster : ''
  dataParams.annotation = annotation
  dataParams.subsample = queryParams.subsample ? queryParams.subsample : ''
  dataParams.consensus = queryParams.consensus ? queryParams.consensus : null
  dataParams.spatialGroups = queryParams.spatialGroups ? queryParams.spatialGroups.split(',') : []
  dataParams.genes = geneParamToArray(queryParams.genes)
  dataParams.heatmapRowCentering = queryParams.rowCentered ? queryParams.rowCentered : DEFAULT_ROW_CENTERING
  return dataParams
}

/** converts the params objects into a query string, inverse of build*ParamsFromQuery */
function buildQueryFromParams(dataParams, renderParams) {
  const querySafeOptions = {
    cluster: dataParams.cluster,
    annotation: getIdentifierForAnnotation(dataParams.annotation),
    genes: geneArrayToParam(dataParams.genes),
    consensus: dataParams.consensus,
    spatialGroups: dataParams.spatialGroups.join(','),
    rowCentered: dataParams.heatmapRowCentering,
    tab: renderParams.tab,
    scatterColor: renderParams.scatterColor,
    distributionPlot: renderParams.distributionPlot,
    heatmapFit: renderParams.heatmapFit
  }
  // remove keys which were not user-specified
  Object.keys(querySafeOptions).forEach(key => {
    if (!dataParams.userSpecified[key] && !renderParams.userSpecified[key]) {
      delete querySafeOptions[key]
    }
  })
  return stringifyQuery(querySafeOptions)
}

/** converts query string params into the renderParams object, which controls plot visualization customization */
function buildRenderParamsFromQuery(query) {
  const queryParams = queryString.parse(query)
  const renderParams = _clone(defaultRenderParams)
  renderParams.userSpecified = {}
  const urlProps = ['scatterColor', 'distributionPlot', 'tab', 'heatmapFit']
  urlProps.forEach(optName => {
    if (queryParams[optName] && queryParams[optName].length) {
      renderParams[optName] = queryParams[optName]
      renderParams.userSpecified[optName] = true
    }
  })
  return renderParams
}


/**
 * manages view options and basic layout for the explore tab
 * this component handles calling the api explore endpoint to get view options (clusters, etc..) for the study
 */
function RoutableExploreTab({ studyAccession }) {
  const [exploreInfo, setExploreInfo] = useState(null)
  const location = useLocation()
  const [showDataParams, setShowDataParams] = useState(true)
  const [isCellSelecting, setIsCellSelecting] = useState(false)
  const [currentPointsSelected, setCurrentPointsSelected] = useState(null)
  const dataParams = buildDataParamsFromQuery(location.search)
  const renderParams = buildRenderParamsFromQuery(location.search)
  const tabContainerEl = useRef(null)


  let controlDataParams = _clone(dataParams)
  if (exploreInfo && !dataParams.cluster) {
    // if the user hasn't specified anything yet, but we have the study defaults, use those
    controlDataParams = Object.assign(controlDataParams, getDefaultClusterParams(exploreInfo.annotationList))
  }

  let hasSpatialGroups = false
  if (exploreInfo) {
    hasSpatialGroups = exploreInfo.spatialGroupNames.length > 0
  }

  /** in the event a component takes an action which updates the list of annotations available
    * e.g. by creating a user annotation, this updates the list */
  function setAnnotationList(newAnnotationList) {
    const newExploreInfo = Object.assign({}, exploreInfo, { annotationList: newAnnotationList })
    setExploreInfo(newExploreInfo)
  }

  /** Merges the received update into the dataParams, and updates the page URL if need */
  function updateDataParams(newOptions, wasUserSpecified=true) {
    const mergedOpts = Object.assign({}, dataParams, newOptions)
    const newRenderParams = _clone(renderParams)
    if (wasUserSpecified) {
      // this is just default params being fetched from the server, so don't change the url
      Object.keys(newOptions).forEach(key => {
        mergedOpts.userSpecified[key] = true
      })
      if (newOptions.consensus || newOptions.genes) {
        // if the user does a gene search or changes the consensus, switch back to the default tab
        delete newRenderParams.tab
        delete newRenderParams.userSpecified.tab
      }
    }
    const query = buildQueryFromParams(mergedOpts, newRenderParams)
    // view options settings should not add history entries
    // e.g. when a user hits 'back', it shouldn't undo their cluster selection,
    // it should take them to the page they were on before they came to the explore tab
    navigate(`${query}#study-visualize`, { replace: true })
  }

  /** Merges the received update into the renderParams, and updates the page URL if need */
  function updateRenderParams(newOptions, wasUserSpecified=true) {
    const mergedOpts = Object.assign({}, renderParams, newOptions)
    if (wasUserSpecified) {
      // this is just default params being fetched from the server, so don't change the url
      Object.keys(newOptions).forEach(key => {
        mergedOpts.userSpecified[key] = true
      })
    }
    const query = buildQueryFromParams(dataParams, mergedOpts)
    // view options settings should not add history entries
    navigate(`${query}#study-visualize`, { replace: true })
  }

  /** copies the url to the clipboard */
  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
  }

  /** handler for when the user selects points in a plotly scatter graph */
  function plotPointsSelected(points) {
    setCurrentPointsSelected(points)
  }

  /** Handle clicks on "View Options" toggler element */
  function handleViewOptionsClick() {
    setShowDataParams(!showDataParams)
  }

  useEffect(() => {
    fetchExplore(studyAccession).then(result => setExploreInfo(result))
  }, [studyAccession])

  // Toggle "View Options" panel
  const dataParamsIcon = showDataParams ? faCaretRight : faCaretLeft
  let [mainViewClass, controlPanelClass, optionsLinkClass] = ['col-md-12', 'hidden view-options', 'closed']
  if (showDataParams) {
    [mainViewClass, controlPanelClass, optionsLinkClass] = ['col-md-10', 'col-md-2 view-options', 'open']
  }

  return (
    <div className="study-explore">

      <div className="row">
        <div className={mainViewClass} ref={tabContainerEl}>
          <ExploreDisplayTabs studyAccession={studyAccession}
            dataParams={dataParams}
            controlDataParams={controlDataParams}
            renderParams={renderParams}
            showDataParams={showDataParams}
            updateDataParams={updateDataParams}
            updateRenderParams={updateRenderParams}
            exploreInfo={exploreInfo}
            isCellSelecting={isCellSelecting}
            plotPointsSelected={plotPointsSelected}/>
        </div>
        <div className={controlPanelClass}>

          <ClusterControls studyAccession={studyAccession}
            dataParams={controlDataParams}
            setDataParams={updateDataParams}
            preloadedAnnotationList={exploreInfo ? exploreInfo.annotationList : null}
            fetchAnnotationList={false}
            showConsensus={dataParams.genes.length > 1}/>
          { hasSpatialGroups &&
            <SpatialSelector spatialGroupNames={exploreInfo.spatialGroupNames}
              dataParams={dataParams}
              updateDataParams={updateDataParams}/>
          }
          <CreateAnnotation
            isSelecting={isCellSelecting}
            setIsSelecting={setIsCellSelecting}
            annotationList={exploreInfo ? exploreInfo.annotationList : null}
            currentPointsSelected={currentPointsSelected}
            dataParams={controlDataParams}
            updateDataParams={updateDataParams}
            setAnnotationList={setAnnotationList}
            studyAccession={studyAccession}/>
          <PlotDisplayControls renderParams={renderParams}
            updateRenderParams={updateRenderParams}
            dataParams={controlDataParams}
            updateDataParams={updateDataParams}/>
          <button onClick={copyLink} className="action" data-toggle="tooltip" title="copy a link to this visualization to the clipboard">
            Copy link <FontAwesomeIcon icon={faLink}/>
          </button>
        </div>
      </div>
      <a className={`action view-options-toggle ${optionsLinkClass}`}
        onClick={() => handleViewOptionsClick()}>
        <FontAwesomeIcon className="fa-lg" icon={dataParamsIcon}/> View Options
      </a>
    </div>
  )
}

/** wraps the explore tab in a Router object so it can use React hooks for routable parameters */
export default function ExploreTab({ studyAccession }) {
  return (
    <Router>
      <RoutableExploreTab studyAccession={studyAccession} default/>
    </Router>
  )
}

/** convenience function for rendering this in a non-React part of the application */
export function renderExploreView(target, studyAccession) {
  ReactDOM.render(
    <ExploreTab studyAccession={studyAccession}/>,
    target
  )
}
