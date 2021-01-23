/**
* @fileoverview UI for "Create Annotations" -- creating a user annotation
*
* User annotations are created by signed-in users in the Explore tab of the
* Study Overview page.
*
* Tutorial showing how this feature should work:
* https://github.com/broadinstitute/single_cell_portal/wiki/Annotations
*
* A user annotation has a name and a set of "selections".  Each selection
* has a label and an array of cell names.  Selections represent cells that the
* user has manually selected -- typically via a free-hand lasso -- in the
* "Clusters" scatter plot.
*/

/* eslint-disable no-invalid-this */

import $ from 'jquery'
import Plotly from 'plotly.js-dist'

import {
  getMainViewOptions
} from 'lib/study-overview/view-options'
import { createUserAnnotation } from 'lib/scp-api'

/**
 * Each selection has a label and an array of cell names.
 *
 * Building on the tutorial linked atop file, here's how selections relate
 * to this JavaScript's model of user annotations:
 *
 * userAnnotation = {
 *   name: "demo-two-groups",
 *   selections: [
 *     {label: "inner", cellArray: ["cell_A", "cell_B"]},
 *     {label: "peripheral", cellArray: ["cell_C", "cell_D"]}
 *   ]
 * }
 */
const labels = ['']
let cellArrays = []

/** Get "Label these cells" text input HTML for each selection */
function getSelectionLabelInput(rowIndex, cellArray, label) {
  const selectionLabelInput =
    `<input type="text"
      name="user_annotation[user_data_arrays_attributes][${rowIndex}][name]"
      id="user_annotation_user_data_arrays_attributes_${rowIndex}_name"
      class="form-control annotation-label need-text"
      placeholder="Label these cells"
      value="${label}">`

  // This is used for the gene search
  const hiddenSelectionInput =
    `<input type="hidden"
      name="user_annotation[user_data_arrays_attributes][${rowIndex}][values]"
      id="user_annotation_user_data_arrays_attributes_${rowIndex}_values"
      value="${cellArray}" />`

  return selectionLabelInput + hiddenSelectionInput
}

/** Get delete button for the row at the given index */
function getDeleteButton(rowIndex, id) {
  const domClasses = 'btn btn-sm btn-danger delete-btn annotation-delete-btn'
  let deleteButton = ''
  if (rowIndex > 0) {
    deleteButton = `${'<td class="col-sm-1" style="padding-top: 27px;">' +
    `<div class="${domClasses}" id="${id}Button">` +
    `<span class="fas fa-times"></span>` +
    `</div>` +
    `</td>`}`
  }
  return deleteButton
}

/** Get text input and surrounding elements for selection label */
function getSelectionRow(rowIndex, cellArrays, id) {
  const name = (rowIndex === 0) ? 'Unselected' : `Selection ${rowIndex}`
  const cellArray = cellArrays[rowIndex]

  const numCells = cellArray.length
  const labelInput =
    getSelectionLabelInput(rowIndex, cellArray, labels[rowIndex])

  const selectionTd =
    `<td id="${id}">${name}: ${numCells} cells${labelInput}</td>`

  const deleteButton = getDeleteButton(rowIndex, id)

  return `<tr>${selectionTd}${deleteButton}</tr>`
}

/** Add rows to the table and update all the other rows */
function updateSelection() {
  // Get all the names of rows to update
  const nameArray = []
  $('#well-table tbody tr').each(function() {
    nameArray.push(this.id)
    $(this).remove()
  })

  cellArrays.forEach((cellArray, i) => {
    // For unselected row, when n == 0
    const id = `Selection${parseInt(i)}`
    const row = getSelectionRow(i, cellArrays, id)
    $('#well-table').prepend(row)
  })

  // Attach listener to make sure all annotation labels are unique
  window.validateUnique('#create_annotations', '.annotation-label')
}

/**
 * Prepare user annotation before posting to SCP REST API
 *
 * API expects selections object that looks like an array.  Consider
 * refactoring user annotation code on server, to modernize this artifact
 * of previously using formData POST bodies, hidden HTML inputs, etc.
 */
function prepareForApi(labels, cellArrays) {
  const name = $('#user-annotation-name').val()

  const selections = {}
  labels.map((label, i) => {
    selections[i] = {
      name: label,
      values: cellArrays[i]
    }
  })

  return { name, selections }
}

// /** Reload panel after saving user annotation */
// function reloadAfterSave() {
//   closeModalSpinner('#generic-modal-spinner', '#generic-modal', function () {
//     $("#annotation").html("<%= escape_javascript(select_tag :annotation, grouped_options_for_select(@cluster_annotations, params[:annotation]), class: 'form-control' )%>");
//     showMessageModal("<%= @notice.present? ? @notice.html_safe : nil %>", "<%= @alert.present? ? @alert.html_safe : nil %>");
//     <% if @user_annotation.errors.any? %>
//       <% @user_annotation.errors.keys.each do |key| %>
//           <% if key === :name %>
//               $('#user_annotation_name').parent().addClass('has-error has-feedback')
//           <% elsif key === :values %>
//               $('.label-name').parent().addClass('has-error has-feedback')
//           <% end %>
//       <% end %>
//     <% end %>
//   });
// }

/** Handle success or failure based on API response */
function handleResponse(response) {
  window.closeModalSpinner('#generic-modal-spinner', '#generic-modal', () => {
    if (response.ok === false) {
      response.json().then(json => {
        window.showMessageModal(json.error)
      })
    } else {
      // New user annotation was successfully saved;
      // inform user and briefly guide them on how to use it
      window.showMessageModal(response.notice)
      // $("#annotation").html("<%= escape_javascript(select_tag :annotation, grouped_options_for_select(@cluster_annotations, params[:annotation]), class: 'form-control' )%>");
    }
  })
}

/** Save new user annotation, inform user of status via modals  */
async function submit() {
  $('#generic-modal-title').html('Saving... Please Wait')

  /* eslint-disable-next-line */
  window.launchModalSpinner('#generic-modal-spinner', '#generic-modal', async () => {
    const accession = window.SCP.studyAccession
    const { cluster, annotation, subsample } = getMainViewOptions(0)

    const { name, selections } = prepareForApi(labels, cellArrays)

    const response = await createUserAnnotation(
      accession, cluster, annotation, subsample,
      name, selections
    )

    handleResponse(response)
  })
}

/**
 * Verify there are enough selections, and that they're properly labeled
 *
 * Inform user of any issues.
 */
function validate() {
  let isValid = false

  const needText = $('.need-text')
  const numFields = needText.toArray().length
  const labels = []
  let allSelectionsAreLabeled = true
  for (let i = 0; i < numFields; i++) {
    const text = needText.eq(i).val()
    labels.push(text)
    if (text === '') {
      allSelectionsAreLabeled = false
    }
  }

  if (numFields < 3) {
    alert('Your annotation must have at least two selections.')
  } else if (allSelectionsAreLabeled === false) {
    alert('Provide a label for all selections before saving.')
    window.setErrorOnBlank(needText)
  } else if (labels.includes('Undefined')) {
    alert('Undefined is a reserved term.  Label this selection differently.')
    window.setErrorOnBlank(needText)
  } else {
    isValid = true
  }

  return isValid
}

/**
 * Validate and submit a new custom user annotation for creation in database.
 *
 * Called upon clicking the "Create Annotation" button.  Does some basic
 * front-end validation, parses DOM for needed data, then posts to SCP REST API.
 */
async function validateAndSubmit() {
  console.log('**** in validateAndSubmit')
  const isValid = validate()

  if (isValid) {
    submit()
  }
}

/** Attach event listeners for user annotations component */
function attachEventListeners(target) {
  // Listen for selections of cells in the target scatter plot
  target.on('plotly_selected', eventData => {
    const cellArray = []

    // Get selected cells curve number and point number
    // plotly only gives x and y values per point, so we have to use point id
    // to get annotation and cell name
    eventData.points.forEach(pt => {
      cellArray.push(target.data[pt.curveNumber].cells[pt.pointNumber])
    })

    // Update previous selections, to ensure they have no duplicate cell names
    cellArrays = cellArrays.map(thisSelection => {
      return window._.difference(thisSelection, cellArray)
    })
    // Add this selected cell array to all the others
    cellArrays.push(cellArray)
    // Add a blank label to array of labels (TODO: make comment more meaningful)
    labels.push('')
    // Remove empty cell arrays and their labels
    cellArrays.forEach((cellArray, i) => {
      if (cellArray.length === 0) {
        cellArrays.splice(i, 1)
        labels.splice(i, 1)
      }
    })
    // After selection, update rows
    updateSelection()
  })

  // Listen for text entry and remember it
  $('#selection-well').on('change paste keyup', '.annotation-label',
    function() {
      const trimmedId = this.id
        .replace('user_annotation_user_data_arrays_attributes_', '')
        .replace('_name', '')
      const index = parseInt(trimmedId)
      labels[index] = $(this).val()
    }
  )

  // Update selections upon clicking selection wells
  $('#selection-well').on('click', '.annotation-delete-btn', function() {
    const trimmedId = this.id.replace('Selection', '').replace('Button', '')
    const index = parseInt(trimmedId)
    cellArrays[0] = cellArrays[0].concat(cellArrays[index])
    cellArrays.splice(index, 1)
    updateSelection()
  })

  $(document).on('click', '#create-annotation-button', () => {
    validateAndSubmit()
  })
}

/**
* Close the user annotations panel if open when rendering clusters
*/
export function closeUserAnnotationsForm() {
  const panel = $('#create-annotation-panel')
  if (panel.attr('class') === '') {
    // Panel is open, so empty inputs and reset button state
    panel.html('')
    panel.toggleClass('collapse')
    $('#toggle-scatter').children().toggleClass('fa-toggle-on fa-toggle-off')
  }
}

/**
 * Write selection table and "Unselected" row to DOM. Only called once.
 */
function writeSelectionTable() {
  const selectionTable = $('#selection-table')

  // Initialize content to a well table
  selectionTable.html(
    '<div class="col-sm-12">' +
        '<table id="well-table" class="table table-condensed">' +
          '<tbody></tbody>' +
        '</table>' +
      '</div>')

  // Add the first row, i.e. "Unselected: {#} cells"
  const row = getSelectionRow(0, cellArrays, '')

  $('#well-table').prepend(row)
}

/**
 * Write initial HTML for "Create Annotations" section
 */
function writeInitialDom() {
  const initialHtml = `
    <div class="row no-bottom-margin form-group" id="selection-well">
      <div class="col-sm-12 form-group">
        <input type="text"
          id="user-annotation-name"
          class="form-control need-text user-annotation-name"
          placeholder="Name this annotation" />
      </div>
      <div id="selection-table"></div>
      <div id="selection-button">
        <div class="col-xs-12 text-center">
          <button id="create-annotation-button" class="btn btn-success">
            Create Annotation
          </button>
        </div>
      </div>
    </div>`

  $('#create-annotation-panel').html(initialHtml)
}

/** Initialize "Create Annotation" functionality for user annotations */
export default function userAnnotations() {
  writeInitialDom()

  $('#selection-well, #selection-button').css('visibility', 'visible')

  // TODO (SCP-2962): Support "Create Annotation" for spatial scatter plots
  const targetPlotId = 'scatter-plot-0'

  const target = document.getElementById(targetPlotId)

  let unselectedCells = target.data.map(trace => trace.cells)

  unselectedCells = unselectedCells.flat()
  cellArrays = [unselectedCells]

  target.layout.dragmode = 'lasso'
  target.layout.scene = { unselectBatch: unselectedCells }

  // Change scatter plot to use lasso mode, for free-hand cell selection
  Plotly.relayout(targetPlotId, target.layout)

  attachEventListeners(target)

  writeSelectionTable()
}
