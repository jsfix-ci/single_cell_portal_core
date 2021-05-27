import React, { useState, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDna } from '@fortawesome/free-solid-svg-icons'
import _uniqueId from 'lodash/uniqueId'
import Plotly from 'plotly.js-dist'

import { fetchCluster } from 'lib/scp-api'
import { logScatterPlot } from 'lib/scp-api-metrics'
import { log } from 'lib/metrics-api'
import { labelFont, getColorBrewerColor } from 'lib/plot'
import { UNSPECIFIED_ANNOTATION_NAME } from 'lib/cluster-utils'
import { useUpdateEffect } from 'hooks/useUpdate'
import PlotTitle from './PlotTitle'
import useErrorMessage, { checkScpApiResponse } from 'lib/error-message'
import { withErrorBoundary } from 'lib/ErrorBoundary'

// sourced from https://github.com/plotly/plotly.js/blob/master/src/components/colorscale/scales.js
export const SCATTER_COLOR_OPTIONS = [
  'Greys', 'YlGnBu', 'Greens', 'YlOrRd', 'Bluered', 'RdBu', 'Reds', 'Blues', 'Picnic',
  'Rainbow', 'Portland', 'Jet', 'Hot', 'Blackbody', 'Earth', 'Electric', 'Viridis', 'Cividis'
]

export const defaultScatterColor = 'Reds'
window.Plotly = Plotly

/** Renders the appropriate scatter plot for the given study and params
  * @param studyAccession {string} e.g. 'SCP213'
  * @param cluster {string} the name of the cluster, or blank/null for the study's default
  * @param annotation {obj} an object with name, type, and scope attributes
  * @param subsample {string} a string for the subsampel to be retrieved.
  * @param consensus {string} for multi-gene expression plots
  * @param dimensions {obj} object with height and width, to instruct plotly how large to render itself
  *   this is useful for rendering to hidden divs
  * @param isCellSelecting whether plotly's lasso selection tool is enabled
  * @plotPointsSelected {function} callback for when a user selects points on the plot, which corresponds
  *   to the plotly "points_selected" event
  */
function RawScatterPlot({
  studyAccession, cluster, annotation, subsample, consensus, genes, scatterColor, dimensions,
  isAnnotatedScatter=false, isCorrelatedScatter=false, isCellSelecting=false, plotPointsSelected, dataCache
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [scatterData, setScatterData] = useState(null)
  const [graphElementId] = useState(_uniqueId('study-scatter-'))
  const { ErrorComponent, setShowError, setErrorContent } = useErrorMessage()
  /** Process scatter plot data fetched from server */
  function handleResponse(clusterResponse) {
    const [scatter, perfTimes] = clusterResponse

    const apiOk = checkScpApiResponse(scatter,
      () => Plotly.purge(graphElementId),
      setShowError,
      setErrorContent)
    if (apiOk) {
      const layout = getPlotlyLayout(dimensions, scatter)
      const plotlyTraces = getPlotlyTraces({
        axes: scatter.axes,
        data: scatter.data,
        annotName: scatter.annotParams.name,
        annotType: scatter.annotParams.type,
        genes: scatter.genes,
        isAnnotatedScatter: scatter.isAnnotatedScatter,
        isCorrelatedScatter: scatter.isCorrelatedScatter,
        scatterColor,
        dataScatterColor: scatter.scatterColor,
        pointAlpha: scatter.pointAlpha,
        pointSize: scatter.pointSize,
        showPointBorders: scatter.showClusterPointBorders,
        is3D: scatter.is3D
      })

      const startTime = performance.now()

      Plotly.react(graphElementId, plotlyTraces, layout)
      sortLegend({
        graphElementId,
        isAnnotatedScatter,
        annotType: scatter.annotParams.type,
        genes: scatter.genes
      })

      perfTimes.plot = performance.now() - startTime

      logScatterPlot(
        { scatter, genes, width: dimensions.width, height: dimensions.height },
        perfTimes
      )
      setScatterData(scatter)
      setShowError(false)
    }
    setIsLoading(false)
  }

  // Fetches plot data then draws it, upon load or change of any data parameter
  useEffect(() => {
    setIsLoading(true)
    // use a data cache if one has been provided, otherwise query scp-api directly
    const fetchMethod = dataCache ? dataCache.fetchCluster : fetchCluster
    fetchMethod({
      studyAccession,
      cluster,
      annotation: annotation ? annotation : '',
      subsample,
      consensus,
      genes,
      isAnnotatedScatter,
      isCorrelatedScatter
    }).then(handleResponse)
  }, [cluster, annotation.name, subsample, consensus, genes.join(','), isAnnotatedScatter])

  // Handles Plotly `data` updates, e.g. changes in color profile
  useUpdateEffect(() => {
    // Don't try to update the color if the graph hasn't loaded yet
    if (scatterData && !isLoading) {
      const dataUpdate = { 'marker.colorscale': scatterColor }
      Plotly.update(graphElementId, dataUpdate)
    }
  }, [scatterColor])

  // Handles cell select mode updates
  useUpdateEffect(() => {
    // Don't try to update the color if the graph hasn't loaded yet
    if (scatterData && !isLoading) {
      const newDragMode = getDragMode(isCellSelecting)
      Plotly.relayout(graphElementId, { dragmode: newDragMode })
      if (!isCellSelecting) {
        Plotly.restyle(graphElementId, { selectedpoints: [null] })
      }
    }
  }, [isCellSelecting])

  // Adjusts width and height of plots upon toggle of "View Options"
  useUpdateEffect(() => {
    // Don't update if the graph hasn't loaded yet
    if (scatterData && !isLoading) {
      const { width, height } = dimensions
      const layoutUpdate = { width, height }
      Plotly.relayout(graphElementId, layoutUpdate)
      sortLegend({
        graphElementId,
        isAnnotatedScatter,
        annotType: annotation.type,
        genes
      })
    }
  }, [dimensions.width, dimensions.height])


  useEffect(() => {
    $(`#${graphElementId}`).on('plotly_selected', plotPointsSelected)
    $(`#${graphElementId}`).on('plotly_legendclick', logLegendClick)
    $(`#${graphElementId}`).on('plotly_legenddoubleclick', logLegendDoubleClick)
    return () => {
      $(`#${graphElementId}`).off('plotly_selected')
      $(`#${graphElementId}`).off('plotly_legendclick')
      $(`#${graphElementId}`).off('plotly_legenddoubleclick')
      Plotly.purge(graphElementId)
    }
  }, [])

  return (
    <div className="plot">
      { ErrorComponent }
      { scatterData &&
        <PlotTitle
          cluster={scatterData.cluster}
          annotation={scatterData.annotParams.name}
          subsample={scatterData.subsample}
          genes={scatterData.genes}
          consensus={scatterData.consensus}
          isCorrelatedScatter={isCorrelatedScatter}
          pearsonsR={scatterData.data.pearsonsR}/>
      }
      <div
        className="scatter-graph"
        id={graphElementId}
        data-testid={graphElementId}
      >
      </div>
      <p className="help-block">
        { scatterData && scatterData.description &&
          <span>{scatterData.description}</span>
        }
      </p>

      {
        isLoading &&
        <FontAwesomeIcon
          icon={faDna}
          data-testid={`${graphElementId}-loading-icon`}
          className="gene-load-spinner"
        />
      }
    </div>
  )
}

const ScatterPlot = withErrorBoundary(RawScatterPlot)
export default ScatterPlot


/** get the array of plotly traces for plotting */
function getPlotlyTraces({
  axes,
  data,
  annotType,
  annotName,
  genes,
  isAnnotatedScatter,
  isCorrelatedScatter,
  scatterColor,
  dataScatterColor,
  pointAlpha,
  pointSize,
  showPointBorders,
  is3D
}) {
  const trace = {
    type: is3D ? 'scatter3d' : 'scattergl',
    mode: 'markers',
    x: data.x,
    y: data.y,
    annotations: data.annotations,
    cells: data.cells,
    opacity: pointAlpha ? pointAlpha : 1
  }
  if (is3D) {
    trace.z = data.z
  }


  const appliedScatterColor = getScatterColorToApply(dataScatterColor, scatterColor)
  if (annotType === 'group' && !genes.length || isCorrelatedScatter) {
    const traceCounts = countOccurences(data.annotations)
    const traceStyles = Object.keys(traceCounts).map((val, index) => {
      return {
        target: val,
        value: {
          name: `${val} (${traceCounts[val]} points)`,
          marker: {
            color: getColorBrewerColor(index),
            size: pointSize
          }
        }
      }
    })
    trace.transforms = [{
      type: 'groupby',
      groups: data.annotations,
      styles: traceStyles
    }]
  } else {
    trace.marker = {
      line: { color: 'rgb(40,40,40)', width: 0 },
      size: pointSize
    }
    const colors = genes.length ? data.expression : data.annotations
    const title = genes.length ? axes.titles.magnitude : annotName
    if (!isAnnotatedScatter) {
      Object.assign(trace.marker, {
        showscale: true,
        colorscale: appliedScatterColor,
        color: colors,
        colorbar: { title, titleside: 'right' }
      })
      // if expression values are all zero, set max/min manually so the zeros still look like zero
      // see SCP-2957
      if (genes.length && !colors.some(val => val !== 0)) {
        trace.marker.cmin = 0
        trace.marker.cmax = 1
      }
    }
  }
  addHoverLabel(trace, annotName, annotType, genes, isAnnotatedScatter, isCorrelatedScatter, axes)
  return [trace]
}

/** return a hash of value=>count for the passed-in array
    This i actually surprisingly quick even for large arrays, but we'd rather we
    didn't have to do this.  See https://github.com/plotly/plotly.js/issues/5612s
*/
function countOccurences(array) {
  return array.reduce((acc, curr) => {
    if (!acc[curr]) {
      acc[curr] = 1
    } else {
      acc[curr] += 1
    }
    return acc
  }, {})
}

/** sorts the scatter plot legend alphabetically
  this is super-hacky in that it relies a lot on plotly internal classnames and styling implementation
  it should only be used as a last resort if https://github.com/plotly/plotly.js/pull/5591
  is not included in Plotly soon
 */
function sortLegend({ graphElementId, isAnnotatedScatter, annotType, genes }) {
  if (isAnnotatedScatter || annotType === 'numeric' || genes.length) {
    return
  }
  const legendTitleRegex = /(.*) \(\d+ points\)/

  const legendTraces = Array.from(document.querySelectorAll(`#${graphElementId} .legend .traces`))
  const legendNames = legendTraces.map(traceEl => {
    return traceEl.textContent.match(legendTitleRegex)[1]
  })
  const sortedNames = [...legendNames].sort((a, b) => {
    if (a === UNSPECIFIED_ANNOTATION_NAME) {return 1}
    if (b === UNSPECIFIED_ANNOTATION_NAME) {return -1}
    return a.localeCompare(b)
  })
  const legendTransforms = legendTraces.map(traceEl => traceEl.getAttribute('transform'))

  legendNames.forEach((traceName, index) => {
    // for each trace, change its transform to the one corresponding to its desired sort order
    const desiredIndex = sortedNames.findIndex(val => val === traceName)
    if (desiredIndex >= 0) {
      legendTraces[index].setAttribute('transform', legendTransforms[desiredIndex])
    }
  })
}

/** makes the data trace attributes (cells, trace name) available via hover text */
function addHoverLabel(trace, annotName, annotType, genes, isAnnotatedScatter, isCorrelatedScatter, axes) {
  trace.text = trace.cells
  // use the 'meta' property so annotations are exposed to the hover template
  // see https://community.plotly.com/t/hovertemplate-does-not-show-name-property/36139
  trace.meta = trace.annotations
  let groupHoverTemplate = '(%{x}, %{y})<br><b>%{text}</b><br>%{meta}<extra></extra>'
  if (isAnnotatedScatter) {
    // for annotated scatter, just show coordinates and cell name
    groupHoverTemplate = `(%{x}, %{y})<br>%{text}`
  } else if ((annotType === 'numeric' || genes.length) && !isCorrelatedScatter) {
    // this is a graph with a continuous color scale
    // the bottom row of the hover will either be the expression value, or the annotation value
    const bottomRowLabel = genes.length ? axes.titles.magnitude : annotName
    groupHoverTemplate = `(%{x}, %{y})<br>%{text} (%{meta})<br>${bottomRowLabel}: %{marker.color}<extra></extra>`
  }
  trace.hovertemplate = groupHoverTemplate
}

/** sets the scatter color on the given races.  If no color is sspecified, it reads the color from the data */
function getScatterColorToApply(dataScatterColor, scatterColor) {
  // Set color scale
  if (!scatterColor) {
    scatterColor = dataScatterColor
  }
  if (!scatterColor) {
    scatterColor = defaultScatterColor
  }
  return scatterColor
}

/** Gets Plotly layout object for scatter plot */
function getPlotlyLayout({ width, height }={}, {
  axes,
  userSpecifiedRanges,
  hasCoordinateLabels,
  coordinateLabels,
  isAnnotatedScatter,
  is3D,
  isCellSelecting=false,
  genes,
  annotParams
}) {
  const layout = {
    hovermode: 'closest',
    font: labelFont,
    dragmode: getDragMode(isCellSelecting)
  }
  if (is3D) {
    layout.scene = get3DScatterProps({
      userSpecifiedRanges, axes, hasCoordinateLabels,
      coordinateLabels
    })
  } else {
    const props2d = get2DScatterProps({
      axes,
      userSpecifiedRanges,
      hasCoordinateLabels,
      coordinateLabels,
      isAnnotatedScatter
    })
    Object.assign(layout, props2d)
  }
  if (!genes.length && annotParams && annotParams.name) {
    layout.legend = {
      itemsizing: 'constant',
      title: { text: annotParams.name }
    }
  }
  layout.width = width
  layout.height = height
  return layout
}

/** Gets Plotly layout object for two-dimensional scatter plot */
function get2DScatterProps({
  axes,
  userSpecifiedRanges,
  hasCoordinateLabels,
  coordinateLabels,
  isAnnotatedScatter
}) {
  const { titles } = axes

  const layout = {
    xaxis: { title: titles.x, range: axes?.ranges?.x },
    yaxis: { title: titles.y, range: axes?.ranges?.y }
  }

  if (isAnnotatedScatter === false) {
    layout.xaxis.showticklabels = false
    layout.yaxis.scaleanchor = 'x'
    layout.yaxis.showticklabels = false
    layout.margin = {
      t: 25,
      r: 0,
      b: 20,
      l: 0
    }
  }

  // if user has supplied a range, set that, otherwise let Plotly autorange
  if (userSpecifiedRanges) {
    layout.xaxis.range = userSpecifiedRanges.x
    layout.yaxis.range = userSpecifiedRanges.y
  } else {
    layout.xaxis.autorange = true
    layout.yaxis.autorange = true
  }

  if (hasCoordinateLabels && !isAnnotatedScatter) {
    // don't show coordinate labels on annotated scatters, since the axes are different
    layout.annotations = coordinateLabels
  }

  return layout
}

const baseCamera = {
  up: { x: 0, y: 0, z: 1 },
  center: { x: 0, y: 0, z: 0 },
  eye: { x: 1.25, y: 1.25, z: 1.25 }
}

/** Gets Plotly layout scene props for 3D scatter plot */
export function get3DScatterProps({
  userSpecifiedRanges, axes, hasCoordinateLabels,
  coordinateLabels
}) {
  const { titles, ranges, aspects } = axes

  const scene = {
    baseCamera,
    aspectmode: 'cube',
    xaxis: { title: titles.x, autorange: true, showticklabels: false },
    yaxis: { title: titles.y, autorange: true, showticklabels: false },
    zaxis: { title: titles.z, autorange: true, showticklabels: false }
  }

  if (userSpecifiedRanges) {
    scene.xaxis.autorange = false
    scene.xaxis.range = ranges.x
    scene.yaxis.autorange = false
    scene.yaxis.range = ranges.y
    scene.zaxis.autorange = false
    scene.zaxis.range = ranges.x
    scene.aspectmode = aspects.mode,
    scene.aspectratio = {
      x: aspects.x,
      y: aspects.y,
      z: aspects.z
    }
  }

  if (hasCoordinateLabels) {
    scene.annotations = coordinateLabels
  }

  return scene
}

/** get the appropriate plotly dragmode option string */
function getDragMode(isCellSelecting) {
  return isCellSelecting ? 'lasso' : 'lasso, select'
}


let currentClickCall = null

/** we don't want to fire two single click events for a double click, so
 * we wait until we've confirmed a click isn't a double click before logging it.
 * Unfortunately (despite the docs indicating otherwise), there doesn't seem to be
 * a way of getting the text of the clicked annotation
 */
function logLegendClick(event) {
  clearTimeout(currentClickCall)
  currentClickCall = setTimeout(() => log('click:scatterlegend:single'), 300)
}

/** log a double-click on a plotly graph legend */
function logLegendDoubleClick(event) {
  clearTimeout(currentClickCall)
  log('click:scatterlegend:double')
}
