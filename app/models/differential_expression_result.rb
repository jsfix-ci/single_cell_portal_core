# store pointers to differential expression output sets for a given cluster/annotation
class DifferentialExpressionResult
  include Mongoid::Document
  include Mongoid::Timestamps

  # minimum number of observed_values, or cells per observed_value
  MIN_OBSERVED_VALUES = 2

  # supported computational methods for differential expression results in Scanpy
  # from https://scanpy.readthedocs.io/en/stable/generated/scanpy.tl.rank_genes_groups.html
  DEFAULT_COMP_METHOD = 'wilcoxon'.freeze
  SUPPORTED_COMP_METHODS = [
    DEFAULT_COMP_METHOD, 'logreg', 't-test', 't-test_overestim_var'
  ].freeze

  belongs_to :study
  belongs_to :cluster_group

  field :cluster_name, type: String # cache name of cluster at time of creation to avoid renaming issues
  field :observed_values, type: Array, default: []
  field :annotation_name, type: String
  field :annotation_scope, type: String
  field :computational_method, type: String, default: DEFAULT_COMP_METHOD
  field :matrix_file_id, type: BSON::ObjectId # associated raw count matrix study file

  validates :annotation_scope, inclusion: { in: %w[study cluster] }
  validates :cluster_name, :matrix_file_id, presence: true
  validates :computational_method, inclusion: { in: SUPPORTED_COMP_METHODS }
  validates :annotation_name, presence: true, uniqueness: { scope: %i[study cluster_group annotation_scope] }
  validate :has_observed_values?
  validate :matrix_file_exists?

  before_validation :set_observed_values, :set_cluster_name
  before_destroy :remove_output_files

  # pointer to source annotation object, either CellMetadatum of ClusterGroup#cell_annotation
  def annotation_object
    case annotation_scope
    when 'study'
      study.cell_metadata.by_name_and_type(annotation_name, 'group')
    when 'cluster'
      cluster_group.cell_annotations.detect do |annotation|
        annotation[:name] == annotation_name && annotation[:type] == 'group'
      end
    end
  end

  # get query string formatted annotation identifier, e.g. cell_type__ontology_label--group--study
  def annotation_identifier
    case annotation_scope
    when 'study'
      annotation_object.annotation_select_value
    when 'cluster'
      cluster_group.annotation_select_value(annotation_object)
    end
  end

  ## STUDY FILE GETTERS
  # associated raw count matrix
  def matrix_file
    StudyFile.find(matrix_file_id)
  end

  # name of associated matrix file
  def matrix_file_name
    matrix_file.upload_file_name
  end

  # associated clustering file
  def cluster_file
    cluster_group.study_file
  end

  # associated annotation file
  def annotation_file
    case annotation_scope
    when 'study'
      study.metadata_file
    when 'cluster'
      cluster_file
    end
  end

  # compute the relative path inside a GCS bucket of a DE output file for a given label
  def bucket_path_for(label)
    "_scp_internal/differential_expression/#{filename_for(label)}"
  end

  # individual filename of label-specific result
  # will convert non-word characters to underscores "_", except plus signs "+" which are changed to "pos"
  # this is to handle cases where + or - are the only difference in labels, such as CD4+ and CD4-
  def filename_for(label)
    basename = [
      cluster_name,
      annotation_name,
      label,
      annotation_scope,
      computational_method
    ].map { |val| val.gsub(/\+/, 'pos').gsub(/\W/, '_') }.join('--')
    "#{basename}.tsv"
  end

  # map of all observed result files, of label value => label-specific filenames
  # this is important as it sidesteps the issue of study owners renaming clusters, as cluster_name is cached here
  def result_files
    files = observed_values.map { |label| filename_for(label) }
    Hash[observed_values.zip(files)]
  end

  # array of result file paths relative to associated bucket root
  def bucket_files
    observed_values.map { |label| bucket_path_for(label) }
  end

  # nested array of arrays representation of :result_files (for select menu options)
  def select_options
    result_files.to_a
  end

  private

  # find the intersection of annotation values from the source, filtered for cells observed in cluster
  def set_observed_values
    cells_by_label = ClusterVizService.cells_by_annotation_label(cluster_group,
                                                                 annotation_name,
                                                                 annotation_scope)
    observed = cells_by_label.keys.reject { |label| cells_by_label[label].count < MIN_OBSERVED_VALUES }
    self.observed_values = observed
  end

  def set_cluster_name
    self.cluster_name = cluster_group.name
  end

  def has_observed_values?
    if observed_values.count < MIN_OBSERVED_VALUES
      errors.add(:observed_values, "must have at least #{MIN_OBSERVED_VALUES} values")
    end
  end

  def matrix_file_exists?
    matrix_file.present?
  end

  # delete all associated output files on destroy
  def remove_output_files
    # prevent failures when bucket doesn't exist, or if this is running in a cleanup job after a study is destroyed
    # these are mostly for protection in CI when calling study.destroy_and_remove_workspace
    # in production, DeleteQueueJob will handle all necessary cleanup
    return true if study.nil? || study.detached || study.queued_for_deletion

    bucket_files.each do |filepath|
      identifier = " #{study.accession}:#{annotation_name}--group--#{annotation_scope}"
      remote = ApplicationController.firecloud_client.get_workspace_file(study.bucket_id, filepath)
      if remote.present?
        Rails.logger.info "Removing DE output #{identifier} at #{filepath}"
        remote.delete
      end
    end
  end
end
