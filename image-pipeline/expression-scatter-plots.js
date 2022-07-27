/**
 * @fileoverview: Make static images of SCP gene expression scatter plots
 *
 * See adjacent README for installation, background
 *
 * To use, ensure you're on VPN, then:
 * cd image-pipeline
 * node expression-scatter-plots.js --accession="SCP303"
 */
import { parseArgs } from 'node:util'
import { access } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import os from 'node:os'

import puppeteer from 'puppeteer'

const args = process.argv.slice(2)

const options = {
  accession: { type: 'string' }
}
const { values } = parseArgs({ args, options })

// const numCPUs = os.cpus().length / 2 // Count on Intel i7 is 1/2 of reported
const numCPUs = 2
console.log(`Number of CPUs to be used on this client: ${numCPUs}`)

// Make `images` directory if absent
access('images', async err => {
  if (err) {
    await mkdir('images')
  }
})

/** Print message with browser-tag preamble to local console */
function print(message, preamble) {
  console.log(`${preamble} ${message}`)
}

function isBardPost(request) {
  return request.url().includes('bard') && request.method() === 'POST'
}

/** Returns boolean for if request is relevant Bard / Mixpanel log */
function isExpressionScatterPlotLog(request) {
  if (isBardPost(request)) {
    const payload = JSON.parse(request.postData())
    const props = payload.properties
    return (payload.event === 'plot:scatter' && props.genes.length === 1)
  }
  return false
}

/** In Explore view, search gene, await plot, save plot image locally */
async function makeExpressionScatterPlotImage(gene, page, preamble) {
  print(`Inputting search for gene: ${gene}`, preamble)
  // Trigger a gene search
  await page.waitForSelector('.gene-keyword-search input')
  await page.type('.gene-keyword-search input', gene, { delay: 1 })
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1000)
  await page.$eval('.gene-keyword-search button', el => el.click())
  print(`Awaiting expression plot for gene: ${gene}`, preamble)
  const expressionPlotStartTime = Date.now()

  // Wait for reliable signal that expression plot has finished rendering.
  // A Mixpanel / Bard log request always fires immediately upon render.
  await page.waitForRequest(request => {
    // print('request', preamble)
    // console.log(request)
    return isExpressionScatterPlotLog(request, gene)
  })

  const expressionPlotPerfTime = Date.now() - expressionPlotStartTime
  print(`Expression plot time for gene ${gene}: ${expressionPlotPerfTime} ms`, preamble)

  // Height and width of plot, x- and y-offset from viewport origin
  const clipDimensions = { height: 595, width: 660, x: 5, y: 375 }

  // Take a screenshot, save it locally.
  const imagePath = `images/${gene}.webp`
  await page.screenshot({ path: imagePath, type: 'webp', clip: clipDimensions })

  print(`Wrote ${imagePath}`, preamble)

  // Clear search input to avoid wrong plot type
  await page.$eval('.gene-keyword-search-input svg', el => el.parentElement.click())

  await page.waitForTimeout(1000)

  return
}

/** CPU-level wrapper to make images for a sub-list of genes */
async function processScatterPlotImages(genes, context) {
  const { accession, preamble, origin } = context
  const browser = await puppeteer.launch()
  // const browser = await puppeteer.launch({ headless: false, devtools: true })
  const page = await browser.newPage()
  await page.setViewport({
    width: 1680,
    height: 1000,
    deviceScaleFactor: 1
  })

  const timeoutMinutes = 2
  const timeoutMilliseconds = timeoutMinutes * 60 * 1000
  // page.setDefaultTimeout(0) // No timeout
  page.setDefaultTimeout(timeoutMilliseconds)

  await page.setRequestInterception(true)
  page.on('request', request => {
    // Drop extraneous requests, to minimize undue  load
    const url = request.url()
    const isGA = url.includes('google-analytics')
    const isSentry = url.includes('ingest.sentry.io')
    const isNonExpPlotBardPost = isBardPost(request) && !isExpressionScatterPlotLog(request)
    const isIgnorableLog = isGA || isSentry || isNonExpPlotBardPost
    const isViolinPlot = url.includes('/expression/violin')
    const isIdeogram = url.includes('/ideogram@')
    if (isIgnorableLog || isViolinPlot || isIdeogram) {
      request.abort()
    } else {
      const headers = Object.assign({}, request.headers(), {
        'sec-ch-ua': undefined // remove "sec-ch-ua" header
      })
      request.continue({ headers })
    }
  })

  // page.on('response', response => {
  //   const url = response.url()
  //   if (url.includes('expression&gene=')) {
  //     print('response.status()', preamble)
  //     console.log(response.status())
  //   }
  // })

  page.on('requestfailed', request => {
    const url = request.url()
    if (url.includes('expression&gene=')) {
      print('request.url()', preamble)
      console.log(request.url())
      console.log(request.headers())
      console.log(request.failure())
      const failedGene = url.split('gene=')[1]
      console.log('failedGene', failedGene)
    }
  })

  // page.on('error', err => {
  //   print(`Error: ${err.toString()}`, preamble)
  // })

  // page.on('pageerror', err => {
  //   console.log(`Page error: ${err.toString()}`)
  // })

  // Go to Explore tab in Study Overview page
  const exploreViewUrl = `${origin}/single_cell/study/${accession}#study-visualize`
  print(`Navigating to Explore tab: ${exploreViewUrl}`, preamble)
  await page.goto(exploreViewUrl)
  print(`Completed loading Explore tab`, preamble)

  console.log('genes.length')
  console.log(genes.length)

  for (let i = 0; i < genes.length; i++) {
    const gene = genes[i]
    await makeExpressionScatterPlotImage(gene, page, preamble)
  }

  await browser.close()
}

/** Get a segment of the uniqueGenes array to process in given CPU */
function sliceGenes(uniqueGenes, numCPUs, cpuIndex) {
  const batchSize = uniqueGenes.length / numCPUs
  const start = batchSize * cpuIndex
  const end = batchSize * (cpuIndex + 1)
  return uniqueGenes.slice(start, end)
}

(async () => {
  const accession = values.accession
  console.log(`Accession: ${accession}`)

  // Get list of all genes in study
  const origin = 'https://singlecell-staging.broadinstitute.org'
  const exploreApiUrl = `${origin}/single_cell/api/v1/studies/${accession}/explore`
  const response = await fetch(exploreApiUrl)
  const json = await response.json()
  const uniqueGenes = json.uniqueGenes
  console.log(`Number of genes: ${uniqueGenes.length}`)

  for (let cpuIndex = 0; cpuIndex < numCPUs - 1; cpuIndex++) {
    /** Log prefix to distinguish messages for different browser instances */
    const preamble = `Browser ${cpuIndex}:`

    // Pick a random gene
    // const geneIndex = Math.floor(Math.random() * uniqueGenes.length)
    // const gene = uniqueGenes[geneIndex]

    // Generate a series of plots, then save them locally
    const genes = sliceGenes(uniqueGenes, numCPUs, cpuIndex)

    const context = { accession, preamble, origin }

    processScatterPlotImages(genes, context)
  }
})()