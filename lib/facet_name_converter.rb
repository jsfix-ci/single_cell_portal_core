# class for converting from Alexandria convention names to HCA or TIM metadata model names (i.e. columns, not individual values)
# this is currently for PoC work on XDSS - eventually this will be replaced by an onotology server that can handle
# conversions programmatically
# entries have a :name (column name in query results for facet matching) and :id (ElasticSearch encoded property name)
class FacetNameConverter
  # map of Alexandria metadata convention names to HCA 'short' names
  ALEXANDRIA_TO_HCA = {
    biosample_id: { name: 'biosample_id', id: 'biosample_id' },
    cell_type: { name: 'cell_type', id: 'cell_type' },
    donor_id: { name: 'donor_id', id: 'donor_id' },
    disease: { name: 'disease', id: 'disease' },
    library_preparation_protocol: {name: 'library_construction_method', id: 'library_construction_method' },
    organ: { name: 'organ', id: 'organ' },
    organism_age: { name: 'organism_age', id: 'organism_age' },
    sex: { name: 'sex', id: 'sex' },
    species: { name: 'genus_species', id: 'genus_species' },
    study_name: { name: 'project_title', id: 'project_title' },
    study_description: { name: 'project_description', id: 'project_description' },
    accession: {name: 'project_short_name', id: 'project_short_name'}
  }.freeze

  # map of Alexandria metadata convention names to namespace Terra Interoperability Model (TIM) names
  ALEXANDRIA_TO_TIM = {
    biosample_id: { name: 'dct:identifier', id: 'tim__a__terraa__corec__a__bioa__samplep__dctc__identifier' },
    donor_id: { name: 'prov:wasDerivedFrom', id: 'tim__a__terraa__corec__a__bioa__sampleprovc__wasa__deriveda__from' },
    disease: { name: 'TerraCore:hasDisease', id: 'tim__a__terraa__corec__a__bioa__samplea__terraa__corec__c__hasa__disease' },
    library_preparation_protocol: { name: 'TerraCore:hasLibraryPrep', id: 'tim__a__terraa__corec__a__bioa__samplea__terraa__corec__hasa__librarya__prep' },
    organ: { name: 'TerraCore:hasAnatomicalSite', id: 'tim__a__terraa__corec__a__bioa__samplea__terraa__corec__hasa__anatomicala__site' },
    organism_age: { name: 'organism_age', id: 'organism_age' },
    sex: { name: 'TerraCore:hasSex', id: 'tim__a__terraa__corec__a__donora__terraa__corec__hasa__sex' },
    species: { name: 'TerraCore:hasOrganismType', id: 'tim__a__terraa__corec__a__donora__terraa__corec__hasa__organisma__type' },
    study_name: { name: 'dct:title', id: 'tim__dctc__title' },
    study_description: { name: 'dct:description', id: 'tim__dctc__description' },
    accession: { name: 'rdfs:label', id: 'tim__rdfsc__label'}
  }.freeze


  # map of Terra Interoperability Model (TIM) metadata convention names to Alexandria metadata convention names
  TIM_TO_ALEXANDRIA = {
    'dct:identifier': { name: 'biosample_id' },
    'prov:wasDerivedFrom': { name: 'donor_id' },
    'TerraCore:hasDisease': { name: 'disease'},
    'TerraCore:hasLibraryPrep': { name: 'library_preparation_protocol'},
    'TerraCore:hasAnatomicalSite': { name: 'organ'},
    'organism_age': { name: 'organism_age'},
    'TerraCore:hasSex': { name: 'sex'},
    'TerraCore:hasOrganismType': {name: 'species'},
    'dct:title': { name: 'study_name' },
    'dct:description': { name: 'study_description'},
    'rdfs:label': { name: 'accession'}
  }.freeze
  

  # convert from SCP metadata names to Terra Interoperability Model or HCA short names
  #
  # * *params*
  #   - +model_name+ (String, Symbol) => Name of schema to convert to (:hca or :tim)
  #   - +column_name+ (String, Symbol) => facet name to convert
  #   - +property+ (String, Symbol) => property to return (:id or :name only)
  #
  # * *returns*
  #   - (String) => String value of requested column/property
  def self.convert_to_model(model_name, column_name, property)
    mappings = model_name.to_sym == :hca ? ALEXANDRIA_TO_HCA : ALEXANDRIA_TO_TIM
    # perform lookup, but fall back to provided column name if no match is found
    mappings[column_name.to_sym]&.dig(property.to_sym) || column_name
  end



  # convert from Terra Interoperability Model to SCP metadata names 
  #
  # * *params*
  #   - +column_name+ (String, Symbol) => facet name to convert
  #   - +property+ (String, Symbol) => property to return (:id or :name only)
  #
  # * *returns*
  #   - (String) => String value of requested column/property
  def self.convert_to_scp(column_name, property)
    mappings = TIM_TO_ALEXANDRIA
    mappings[column_name.to_sym]&.dig(property.to_sym) || column_name
  end
end
