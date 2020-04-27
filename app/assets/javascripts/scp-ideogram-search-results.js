/* eslint-disable */

var ensemblBase = 'https://rest.ensembl.org';
var organism = 'mouse';
var taxid = '10090';
var chrHeight = 90;
var shape = 'triangle';

var searchResultsLegend = [{
  name: 'Click paralog to search',
  rows: [
    {name: 'Paralog', color: 'pink', shape: shape},
    {name: 'Searched gene', color: 'red', shape: shape}
  ]
}];

async function fetchEnsembl(path, body=null, method='GET') {
  let init = {
    method: method,
    headers: {'Content-Type': 'application/json'}
  }
  if (body !== null) init.body = JSON.stringify(body);
  var response = await fetch(ensemblBase + path, init);
  var json = await response.json();
  return json;
}

/**
 * Fetch paralogs of searched gene
 */
async function fetchParalogPositions(annot, annots) {
  // var taxid = Ideogram.config.taxid;
  var orgUnderscored = organism.replace(/-/g, '_');

  var params = '&format=condensed&type=paralogues&target_taxon=' + taxid;
  let path = `/homology/id/${annot.id}?${params}`
  var ensemblHomologs = await fetchEnsembl(path);
  var homologs = ensemblHomologs.data[0].homologies;

  // Fetch positions of paralogs
  homologIds = homologs.map(homolog => homolog.id)
  path = '/lookup/id/' + orgUnderscored;
  let body = {'ids': homologIds, 'species': orgUnderscored, 'object_type': 'gene'}
  var ensemblHomologGenes = await fetchEnsembl(path, body, 'POST');

  Object.entries(ensemblHomologGenes).map((idGene, i) => {
    let gene = idGene[1]
    annot = {
      name: gene.display_name,
      chr: gene.seq_region_name,
      start: gene.start,
      stop: gene.end,
      id: gene.id,
      shape: 'triangle',
      color: 'pink',
      height: 3
    };
    // Add to start of array, so searched gene gets top z-index
    annots.unshift(annot);
  })

  return annots;
}

async function plotGeneAndParalogs(geneSymbols) {

  // Refine style
  document.querySelectorAll('.chromosome').forEach(chromosome => {
    chromosome.style.cursor = '';
  })
  var lastChr = [...document.querySelectorAll('.chromosome-set')].slice(-1)[0]
  var left = lastChr.getBoundingClientRect().x;
  var topPx = chrHeight + 40;
  var style =
    `float: left; position: relative; top: -${topPx}px; left: ${left}px;`;

  // Fetch position of searched gene
  var orgUnderscored = organism.replace(/-/g, '_');
  let path = '/lookup/symbol/' + orgUnderscored;
  let body = {'symbols': geneSymbols}
  var ensemblGenes = await fetchEnsembl(path, body, 'POST');

  let annots = []
  geneSymbols.forEach(async geneSymbol => {
    let gene = ensemblGenes[geneSymbol]
    let annot = {
      name: gene.display_name,
      chr: gene.seq_region_name,
      start: gene.start,
      stop: gene.end,
      id: gene.id,
      shape: 'triangle',
      color: 'red'
    };
    annots.push(annot)

    annots = await fetchParalogPositions(annot, annots)
    ideogram.drawAnnots(annots);
    document.querySelector('#_ideogramLegend').style = style;
  });

  ideogram.drawAnnots(annots);

  document.querySelector('#_ideogramLegend').style = 'display: none;';
}

// Process text input for the "Search" field.
function handleSearch(event) {
  // Ignore non-"Enter" keyups
  if (event.type === 'keyup' && event.keyCode !== 13) return;

  var searchInput = event.target.value.trim();

  // Handles "BRCA1,BRCA2", "BRCA1 BRCA2", and "BRCA1, BRCA2"
  let geneSymbols = searchInput.split(/[, ]/).filter(d => d !== '')
  plotGeneAndParalogs(geneSymbols);
}

function onClickAnnot(annot) {
  plotGeneAndParalogs([annot.name]);
}

function createSearchResultsIdeogram() {
  if (typeof window.ideogram !== 'undefined') {
    delete window.ideogram
    $('#_ideogramOuterWrap').html('')
  }

  $('#ideogramWarning, #ideogramTitle').remove();

  document.querySelector('#ideogramSearchResultsContainer').style =
    `position: relative;
    top: -60px;
    height: 0;
    float: right`;

  window.ideoConfig = {
    container: '#ideogramSearchResultsContainer',
    organism: 'mouse',
    chrHeight: 85,
    chrLabelSize: 10,
    annotationHeight: 5,
    chrWidth: 8,
    dataDir: 'https://unpkg.com/ideogram@1.19.0/dist/data/bands/native/',
    legend: searchResultsLegend,
    debug: true,
    rotatable: false,
    showFullyBanded: false,
    onClickAnnot: onClickAnnot,
    onLoad: function() {
      var left = document.querySelector('#_ideogramInnerWrap').style['max-width'];
      document.querySelector('#ideogramSearchResultsContainer').style.width = left;

      var searchInput = document.querySelector('#search_genes').value.trim();

      // Handles "BRCA1,BRCA2", "BRCA1 BRCA2", and "BRCA1, BRCA2"
      let geneSymbols = searchInput.split(/[, ]/).filter(d => d !== '')
      plotGeneAndParalogs(geneSymbols);
    }
  }

  window.ideogram = new Ideogram(window.ideoConfig)
}
