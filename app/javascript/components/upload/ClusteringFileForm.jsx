import React from 'react'


import Select from '~/lib/InstrumentedSelect'
import { FileTypeExtensions } from './upload-utils'
import { TextFormField } from './form-components'
import ExpandableFileForm from './ExpandableFileForm'
import { validateFile } from './upload-utils'

const allowedFileExts = FileTypeExtensions.plainText
const requiredFields = [{ label: 'Name', propertyName: 'name' }]

/** renders a form for editing/uploading a single cluster file */
export default function ClusteringFileForm({
  file,
  allFiles,
  updateFile,
  saveFile,
  deleteFile,
  associatedClusterFileOptions=[],
  updateCorrespondingClusters,
  bucketName,
  isInitiallyExpanded
}) {
  const spatialClusterAssocs = file.spatial_cluster_associations
    .map(id => associatedClusterFileOptions.find(opt => opt.value === id))
  const validationMessages = validateFile({
    file, allFiles, allowedFileExts, requiredFields
  })

  return <ExpandableFileForm {...{
    file, allFiles, updateFile, saveFile,
    allowedFileExts, deleteFile, validationMessages, bucketName, isInitiallyExpanded
  }}>
    <TextFormField label="Name" fieldName="name" file={file} updateFile={updateFile}/>
    { file.is_spatial &&
      <div className="form-group">
        <label className="labeled-select">Corresponding clusters
          <Select options={associatedClusterFileOptions}
            data-analytics-name="spatial-associated-clusters"
            value={spatialClusterAssocs}
            isMulti={true}
            placeholder="None"
            onChange={val => updateCorrespondingClusters(file, val)}/>
        </label>
      </div>
    }
    <TextFormField label="Description / Figure legend (this will be displayed below cluster)"
      fieldName="description" file={file} updateFile={updateFile}/>

    <div className="row">
      <div className="col-md-4">
        <TextFormField label="X axis label" fieldName="x_axis_label" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-4">
        <TextFormField label="Y axis label" fieldName="y_axis_label" file={file} updateFile={updateFile}/>
      </div>
    </div>
    <div className="row">
      <div className="col-md-2">
        <TextFormField label="X domain min" fieldName="x_axis_min" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-2">
        <TextFormField label="X domain max" fieldName="x_axis_max" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-2">
        <TextFormField label="Y domain min" fieldName="y_axis_min" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-2">
        <TextFormField label="Y domain max" fieldName="y_axis_max" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-2">
        <TextFormField label="Z domain min" fieldName="z_axis_min" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-2">
        <TextFormField label="Z domain max" fieldName="z_axis_max" file={file} updateFile={updateFile}/>
      </div>
    </div>
    <div className="row">
      <div className="col-md-4">
        <TextFormField label="External link URL" fieldName="external_link_url" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-4">
        <TextFormField label="External link title" fieldName="external_link_title" file={file} updateFile={updateFile}/>
      </div>
      <div className="col-md-4">
        <TextFormField label="External link description (used as tooltip)" fieldName="external_link_description" file={file} updateFile={updateFile}/>
      </div>
    </div>
  </ExpandableFileForm>
}
