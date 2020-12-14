/**
 * @fileoverview JavaScript client for Single Cell Portal REST API
 *
 * Succinct, well-documented SCP API wrappers, also enabling easy mocks
 *
 * API docs: https://singlecell.broadinstitute.org/single_cell/api
 */

import camelcaseKeys from 'camelcase-keys'
import _compact from 'lodash/compact'
import * as queryString from 'query-string'

import { getAccessToken } from 'providers/UserProvider'
import {
  logSearch, logDownloadAuthorization, mapFiltersForLogging
} from './scp-api-metrics'

// If true, returns mock data for all API responses.  Only for dev.
let globalMock = false

const defaultBasePath = '/single_cell/api/v1'

/** Get default `init` object for SCP API fetches */
export function defaultInit() {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
  // accessToken is a blank string when not signed in
  if (getAccessToken() !== '') {
    headers['Authorization'] = `Bearer ${getAccessToken()}`
  }
  return {
    method: 'GET',
    headers
  }
}

/** Sluggify study name */
export function studyNameAsUrlParam(studyName) {
  return studyName.toLowerCase().replace(/ /g, '-').replace(/[^0-9a-z-]/gi, '')
}

/**
 * Get a one-time authorization code for download, and its lifetime in seconds
 *
 * TODO:
 * - Update API to use "expires_in" instead of "time_interval"
 *
 * Docs: https:///singlecell.broadinstitute.org/single_cell/api/swagger_docs/v1#!/Search/search_auth_code_path
 *
 * @param {Boolean} mock Whether to use mock data.  Helps development, tests.
 * @returns {Promise} Promise object described in "Example return" above
 *
 * @example
 *
 * // returns {authCode: 123456, timeInterval: 1800}
 * fetchAuthCode(true)
 */
export async function fetchAuthCode(mock=false) {
  let init = defaultInit
  if (mock === false && globalMock === false) {
    init = Object.assign({}, defaultInit(), {
      method: 'POST'
    })
  }

  const [authCode, perfTime] = await scpApi('/search/auth_code', init, mock)

  logDownloadAuthorization(perfTime)

  return authCode
}

/**
 * Returns list of all available search facets, including default filter values
 *
 * Docs: https:///singlecell.broadinstitute.org/single_cell/api/swagger_docs/v1#!/Search/search_facets_path
 *
 * @param {Boolean} mock Whether to use mock data.  Helps development, tests.
 * @returns {Promise} Promise object containing camel-cased data from API
 */
export async function fetchFacets(mock=false) {
  let path = '/search/facets'
  const brandingGroup = getBrandingGroup()
  if (brandingGroup) {
    path = `${path}?scpbr=${brandingGroup}`
  }

  const [facets, perfTime] = await scpApi(path, defaultInit(), mock)

  mapFiltersForLogging(facets, true)

  return facets
}

/**
 * Sets flag on whether to use mock data for all API responses.
 *
 * This method is useful for tests and certain development scenarios,
 * e.g. when evolving a new API or to work around occasional API blockers.
 *
 * @param {Boolean} flag Whether to use mock data for all API responses
 */
export function setGlobalMockFlag(flag) {
  globalMock = flag
}

// Modifiable in setMockOrigin, used in unit tests
let mockOrigin = ''

/**
 * Sets origin (e.g. http://localhost:3000) for mocked SCP API URLs
 *
 * This enables mock data to be used from Jest tests
 *
 * @param {Boolean} origin Origin (e.g. http://localhost:3000) for mocked SCP API URLs
 */
export function setMockOrigin(origin) {
  mockOrigin = origin
}

/** Constructs and encodes URL parameters; omits those with no value */
function stringifyQuery(paramObj) {
  // Usage and API: https://github.com/sindresorhus/query-string#usage
  const options = { skipEmptyString: true, skipNull: true }
  const stringified = queryString.stringify(paramObj, options)
  return `?${stringified}`
}

/**
* Returns initial content for the "Explore" tab in Study Overview
*
* @param {String} studyAccession Study accession
*/
export async function fetchExplore(studyAccession, mock=false) {
  const apiUrl = `/studies/${studyAccession}/explore`
  const [exploreInit] =
    await scpApi(apiUrl, defaultInit(), mock, false)

  return exploreInit
}

/**
 * Get all study-wide and cluster annotations for a study
 *
 * see definition at: app/controllers/api/v1/visualization/explore_controller.rb
 *
 * @param {String} studyAccession Study accession
 * @param {Boolean} mock
 */
export async function fetchClusterOptions(studyAccession, mock=false) {
  const apiUrl = `/studies/${studyAccession}/explore/cluster_options`
  const [values] = await scpApi(apiUrl, defaultInit(), mock, false)
  return values
}

/**
 * Returns an object with scatter plot data for a cluster in a study
 *
 * see definition at: app/controllers/api/v1/visualization/clusters_controller.rb
 *
 * @param {String} studyAccession Study accession
 * @param {String} cluster Name of cluster, as defined at upload
 * @param {String} annotation Full annotation name, e.g. "CLUSTER--group--study"
 * @param {String} subsample Subsampling threshold, e.g. 100000
 * @param {String} consensus Statistic to use for consensus, e.g. "mean"
 *
 * Example:
 * https://localhost:3000/single_cell/api/v1/studies/SCP56/clusters/Coordinates_Major_cell_types.txt?annotation_name=CLUSTER&annotation_type=group&annotation_scope=study
 */
export async function fetchCluster(
  studyAccession, cluster, annotation, subsample, consensus, gene=null,
  isAnnotatedScatter=null, mock=false
) {
  // Digest full annotation name to enable easy validation in API
  const [annotName, annotType, annotScope] = annotation.split('--')
  // eslint-disable-next-line camelcase
  const is_annotated_scatter = isAnnotatedScatter
  const paramObj = {
    annotation_name: annotName,
    annotation_type: annotType,
    annotation_scope: annotScope,
    subsample,
    consensus,
    gene,
    is_annotated_scatter
  }

  const params = stringifyQuery(paramObj)

  if (!cluster) {
    cluster = '_default'
  }
  const apiUrl = `/studies/${studyAccession}/clusters/${encodeURIComponent(cluster)}${params}`
  // don't camelcase the keys since those can be cluster names,
  // so send false for the 4th argument
  const [scatter] = await scpApi(apiUrl, defaultInit(), mock, false)

  return scatter
}

/**
 * Returns an object with violin plot expression data for a gene in a study
 *
 * see definition at: app/controllers/api/v1/visualization/expression_controller.rb
 *
 * @param {String} studyAccession Study accession
 * @param {String} gene Gene names to get expression data for
 * @param {String} cluster Gene names to get expression data for
 *
 */
export async function fetchExpressionViolin(
  studyAccession,
  gene,
  clusterName,
  annotationName,
  annotationScope,
  annotationType,
  subsample,
  mock=false
) {
  const paramObj = {
    cluster: clusterName,
    annotation_scope: annotationScope,
    annotation_type: annotationType,
    annotation_name: annotationName,
    subsample,
    gene
  }
  const apiUrl = `/studies/${studyAccession}/expression/violin${stringifyQuery(paramObj)}`
  // don't camelcase the keys since those can be cluster names,
  // so send false for the 4th argument
  const [violin] = await scpApi(apiUrl, defaultInit(), mock, false)

  return violin
}


/**
 * Get all study-wide and cluster annotations for a study
 *
 * see definition at: app/controllers/api/v1/visualization/annotations_controller.rb
 *
 * @param {String} studyAccession Study accession
 * @param {Boolean} mock
 */
export async function fetchAnnotations(studyAccession, mock=false) {
  const apiUrl = `/studies/${studyAccession}/annotations`
  const [values] = await scpApi(apiUrl, defaultInit(), mock, false)
  return values
}

/**
 * Get a single annotation for a study
 *
 * see definition at: app/controllers/api/v1/visualization/annotations_controller.rb
 *
 * @param {String} studyAccession Study accession
 * @param {String} annotationName
 */
export async function fetchAnnotation(studyAccession, clusterName, annotationName, annotationScope, annotationType, mock=false) {
  const paramObj = {
    cluster: clusterName,
    annotation_scope: annotationScope,
    annotation_type: annotationType
  }
  annotationName = annotationName ? annotationName : '_default'
  const apiUrl = `/studies/${studyAccession}/annotations/${encodeURIComponent(annotationName)}${stringifyQuery(paramObj)}`
  const [values] = await scpApi(apiUrl, defaultInit(), mock)
  return values
}

/** Get a url for retrieving a morpheus-suitable annotation values file */
export function getAnnotationCellValuesURL(studyAccession, clusterName, annotationName, annotationScope, annotationType, mock=false) {
  const paramObj = {
    cluster: clusterName,
    annotation_scope: annotationScope,
    annotation_type: annotationType
  }
  annotationName = annotationName ? annotationName : '_default'
  const apiUrl = `/studies/${studyAccession}/annotations/${encodeURIComponent(annotationName)}/cell_values${stringifyQuery(paramObj)}`
  return getFullUrl(apiUrl)
}


/**
 * Returns an url for fetching heatmap expression data for genes in a study
 *
 * A url generator rather than a fetch funtion is provided as morpheus needs a URL string
 *
 * @param {String} studyAccession study accession
 * @param {Array} genes List of gene names to get expression data for
 *
 */
export function getExpressionHeatmapURL(studyAccession, genes, cluster, annotation, subsample) {
  const paramObj = {
    cluster,
    annotation,
    subsample,
    genes: genes.join(',')
  }
  const path = `/studies/${studyAccession}/expression/heatmap${stringifyQuery(paramObj)}`
  return getFullUrl(path)
}


export async function updateCurrentUser(updatedUser, mock=false) {
  const init = Object.assign({}, defaultInit(), {
    method: 'PATCH',
    body: JSON.stringify(updatedUser)
  })
  await scpApi('/current_user', init, mock, true)
}

/**
 * Returns a list of matching filters for a given facet
 *
 * Docs: https:///singlecell.broadinstitute.org/single_cell/api/swagger_docs/v1#!/Search/search_facet_filters_path
 *
 * @param {String} facet Identifier of facet
 * @param {String} query User-supplied query string
 * @param {Boolean} mock Whether to use mock data.  Helps development, tests.
 * @returns {Promise} Promise object containing camel-cased data from API
 *
 * @example
 *
 * // returns Promise for mock JSON
 * // in /mock_data/facet_filters_disease_tuberculosis.json
 * fetchFacetFilters('disease', 'tuberculosis', true);
 *
 * // returns Promise for live JSON as shown example from
 * // "Docs" link above (but camel-cased)
 * fetchFacetFilters('disease', 'tuberculosis');
 */
export async function fetchFacetFilters(facet, query, mock=false) {
  let queryString = `?facet=${facet}&query=${query}`
  if (mock || globalMock) {
    queryString = `_${facet}_${query}`
  }

  const pathAndQueryString = `/search/facet_filters${queryString}`

  const [filters, perfTime] = await scpApi(pathAndQueryString, defaultInit(), mock)
  mapFiltersForLogging(filters)

  return filters
}

/**
 *  Returns number of files and bytes (by file type), to preview bulk download
 *
 * Docs:
 * https://singlecell.broadinstitute.org/single_cell/api/swagger_docs/v1#!/Search/search_bulk_download_size_path
 *
 * @param {Array} accessions List of study accessions to preview download
 * @param {Array} fileTypes List of file types in studies to preview download
 *
 * @example returns Promise for JSON
 * {
 *  "Expression": {"total_files": 4, "total_bytes": 1797720765},
 *  "Metadata": {"total_files": 2, "total_bytes": 865371}
 * }
 * fetchDownloadSize([SCP200, SCP201], ["Expression", "Metadata"])
 */
export async function fetchDownloadSize(accessions, fileTypes, mock=false) {
  const fileTypesString = fileTypes.join(',')
  const queryString = `?accessions=${accessions}&file_types=${fileTypesString}`
  const pathAndQueryString = `/search/bulk_download_size/${queryString}`
  const [size, perfTime] = await scpApi(pathAndQueryString, defaultInit(), mock)
  return size
}

/**
 * Returns a list of matching studies given a keyword and facets
 *
 * Docs: https:///singlecell.broadinstitute.org/single_cell/api/swagger_docs/v1#!/Search/search
 *
 * @param {String} type Type of query to perform (study- or cell-based)
 * @param {Object} searchParams  Search parameters, including
 *   @param {String} terms Searched keywords
 *   @param {Object} facets Applied facets and filters
 *   @param {Integer} page Page in search results
 *   @param {String} order Results ordering field
 *   @param {String} preset_search Query preset (e.g. 'covid19')
 * @param {Boolean} mock Whether to use mock data
 * @returns {Promise} Promise object containing camel-cased data from API
 *
 * @example
 *
 * fetchSearch('study', 'tuberculosis');
 */
export async function fetchSearch(type, searchParams, mock=false) {
  const path = `/search?${buildSearchQueryString(type, searchParams)}`

  const [searchResults, perfTime] = await scpApi(path, defaultInit(), mock)

  logSearch(type, searchParams, perfTime)

  return searchResults
}

/**
  * Constructs query string used for /search REST API endpoint
  * auto-appends the branding group if one exists
  */
export function buildSearchQueryString(type, searchParams) {
  const facetsParam = buildFacetQueryString(searchParams.facets)

  const params = ['page', 'order', 'terms', 'preset', 'genes', 'genePage']
  let otherParamString = params.map(param => {
    return searchParams[param] ? `&${param}=${searchParams[param]}` : ''
  }).join('')
  otherParamString = otherParamString.replace('preset=', 'preset_search=')

  let brandingGroupParam = ''
  const brandingGroup = getBrandingGroup()
  if (brandingGroup) {
    brandingGroupParam = `&scpbr=${brandingGroup}`
  }

  return `type=${type}${otherParamString}${facetsParam}${brandingGroupParam}`
}

/** Serializes "facets" URL parameter for /search API endpoint */
function buildFacetQueryString(facets) {
  if (!facets || !Object.keys(facets).length) {
    return ''
  }
  const rawURL = _compact(Object.keys(facets).map(facetId => {
    if (facets[facetId].length) {
      return `${facetId}:${facets[facetId].join(',')}`
    }
  })).join('+')
  // encodeURIComponent needed for the + , : characters
  return `&facets=${encodeURIComponent(rawURL)}`
}

/** Deserializes "facets" URL parameter into facets object */
export function buildFacetsFromQueryString(facetsParamString) {
  const facets = {}
  if (facetsParamString) {
    facetsParamString.split('+').forEach(facetString => {
      const facetArray = facetString.split(':')
      facets[facetArray[0]] = facetArray[1].split(',')
    })
  }
  return facets
}

/** returns the current branding group as specified by the url  */
export function getBrandingGroup() {
  const queryParams = queryString.parse(window.location.search)
  return queryParams.scpbr
}

/** Get full URL for a given including any extension (or a mocked URL) */
function getFullUrl(path, mock=false) {
  if (globalMock) {
    mock = true
  }
  const basePath = (mock || globalMock) ? `${mockOrigin}/mock_data` : defaultBasePath
  let fullPath = basePath + path
  if (mock) {
    fullPath += '.json' // e.g. /mock_data/search/auth_code.json
  }
  return fullPath
}

/**
 * Client for SCP REST API.  Less fetch boilerplate, easier mocks.
 *
 * @param {String} path Relative path for API endpoint, e.g. /search/auth_code
 * @param {Object} init Object for settings, just like standard fetch `init`
 * @param {Boolean} mock Whether to use mock data.  Helps development, tests.
 */
export default async function scpApi(
  path, init, mock=false, camelCase=true, toJson=true
) {
  const perfTimeStart = performance.now()

  const fullPath = getFullUrl(path, mock)

  const response = await fetch(fullPath, init).catch(error => error)

  // Milliseconds taken to fetch data from API
  const perfTime = Math.round(performance.now() - perfTimeStart)

  if (response.ok) {
    if (toJson) {
      const json = await response.json()
      // Converts API's snake_case to JS-preferrable camelCase,
      // for easy destructuring assignment.
      if (camelCase) {
        return [camelcaseKeys(json), perfTime]
      } else {
        return [json, perfTime]
      }
    } else {
      return [response, perfTime]
    }
  }
  return [response, perfTime]
}
