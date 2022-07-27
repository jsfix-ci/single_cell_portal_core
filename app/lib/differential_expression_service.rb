# handle launching differential expression ingest jobs
class DifferentialExpressionService
  # run a differential expression job for a given study on the default cluster/annotation
  #
  # * *params*
  #   - +study_accession+ (String) => Accession of study to use
  #   - +user+ (User) => Corresponding user, will default to study owner
  #
  # * *yields*
  #   - (IngestJob) => Differential expression job in PAPI
  #
  # * *returns*
  #   - (Boolean) => True if job queues successfully
  #
  # * *raises*
  #   - (ArgumentError) => if requested parameters do not validate
  def self.run_differential_expression_on_default(study_accession, user: nil)
    study = Study.find_by(accession: study_accession)
    validate_study(study)
    raise ArgumentError, "#{study.accession} has no default cluster" if study.default_cluster.blank?
    raise ArgumentError, "#{study.accession} has no default annotation" if study.default_annotation.blank?

    annotation_name, annotation_type, annotation_scope = study.default_annotation.split('--')
    raise ArgumentError, "#{study.accession} default annotation is not group-based" if annotation_type != 'group'

    annotation = {
      annotation_name: annotation_name,
      annotation_scope: annotation_scope
    }
    cluster_file = study.default_cluster.study_file
    requested_user = user || study.user
    run_differential_expression_job(cluster_file, study, requested_user, **annotation)
  end

  # same as above method, except runs differential expression job on all eligible annotations
  #
  # * *params*
  #   - +study_accession+ (String) => Accession of study to use
  #   - +user+ (User) => Corresponding user, will default to study owner
  #
  # * *yields*
  #   - (IngestJob) => Differential expression job in PAPI for each valid cluster/annotation combination
  #
  # * *returns*
  #   - (Integer) => Number of DE jobs yielded
  #
  # * *raises*
  #   - (ArgumentError) => if requested study cannot run any DE jobs
  def self.run_differential_expression_on_all(study_accession, user: nil)
    study = Study.find_by(accession: study_accession)
    validate_study(study)
    eligible_annotations = []

    metadata = study.cell_metadata.where(annotation_type: 'group').select(&:can_visualize?)
    eligible_annotations += metadata.map do |meta|
      { annotation_name: meta.name, annotation_scope: 'study' }
    end

    cell_annotations = []
    groups_to_process = study.cluster_groups.select { |cg| cg.cell_annotations.any? }
    groups_to_process.map do |cluster|

      cell_annots = cluster.cell_annotations.select do |annot|
        annot['type'] == 'group' && cluster.can_visualize_cell_annotation?(annot)
      end

      cell_annots.each do |annot|
        annot[:cluster_file_id] = cluster.study_file.id # for checking associations later
      end

      cell_annotations += cell_annots
    end

    eligible_annotations += cell_annotations.map do |annot|
      {
        annotation_name: annot[:name],
        annotation_scope: 'cluster',
        cluster_file_id: annot[:cluster_file_id]
      }
    end
    raise ArgumentError, "#{study_accession} does not have any eligible annotations" if eligible_annotations.empty?

    log_message "#{study_accession} has annotations eligible for DE; validating inputs"
    requested_user = user || study.user

    job_count = 0
    study.cluster_ordinations_files.each do |cluster_file|
      eligible_annotations.each do |annotation|
        begin
          # skip if this is a cluster-based annotation and is not available on this cluster file
          next if annotation[:scope] == 'cluster' && annotation[:cluster_file_id] != cluster_file.id

          annotation_params = annotation.deep_dup # make a copy so we don't lose the association next time we check
          annotation_params.delete(:cluster_file_id)
          annotation_identifier = [annotation_params['annotation_name'],
                                   'group',
                                   annotation_params['annotation_scope']].join('--')
          job_identifier = "#{study_accession}: #{cluster_file.name} (#{annotation_identifier})"
          log_message "Checking DE job for #{job_identifier}"
          DifferentialExpressionService.run_differential_expression_job(
            cluster_file, study, requested_user, **annotation_params
          )
          log_message "DE job for #{job_identifier} successfully launched"
          job_count += 1
        rescue ArgumentError => e
          log_message "Skipping DE job for #{job_identifier} due to: #{e.message}"
        end
      end
    end
    log_message "#{study_accession} yielded #{job_count} differential expression jobs"
    job_count
  end

  # handle setting up and launching a differential expression job
  #
  # * *params*
  #   - +cluster_file+      (StudyFile) => Clustering file being used as control cell list
  #   - +study+            (Study) => Study to which StudyFile belongs
  #   - +user+             (User) => User initiating parse action (for email delivery)
  #   - +annotation_name+  (String) => Name of requested annotation
  #   - +annotation_scope+ (String) => Scope of requested annotation ('study' or 'cluster')
  #   - +machine_type+     (String) => Override default VM machine type
  #
  # * *yields*
  #   - (IngestJob) => Differential expression job in PAPI
  #
  # * *returns*
  #   - (Boolean) => True if job queues successfully
  #
  # * *raises*
  #   - (ArgumentError) => if requested parameters do not validate
  def self.run_differential_expression_job(cluster_file, study, user, annotation_name:, annotation_scope:, machine_type: nil)
    validate_study(study)
    validate_annotation(cluster_file, study, annotation_name, annotation_scope)

    # begin assembling parameters
    de_params = {
      annotation_name: annotation_name,
      annotation_scope: annotation_scope,
      annotation_file: annotation_scope == 'cluster' ? cluster_file.gs_url : study.metadata_file.gs_url,
      cluster_file: cluster_file.gs_url,
      cluster_name: cluster_file.name
    }

    cluster = study.cluster_groups.by_name(cluster_file.name)
    raw_matrix = ClusterVizService.raw_matrix_for_cluster_cells(study, cluster)

    de_params[:matrix_file_path] = raw_matrix.gs_url
    if raw_matrix.file_type == 'MM Coordinate Matrix'
      de_params[:matrix_file_type] = 'mtx'
      # we know bundle exists and is completed as :raw_matrix_for_cluster_cells will throw an exception if it isn't
      bundle = raw_matrix.study_file_bundle
      gene_file = bundle.bundled_file_by_type('10X Genes File')
      barcode_file = bundle.bundled_file_by_type('10X Barcodes File')
      de_params[:gene_file] = gene_file.gs_url
      de_params[:barcode_file] = barcode_file.gs_url
    else
      de_params[:matrix_file_type] = 'dense'
    end
    params_object = DifferentialExpressionParameters.new(de_params)
    params_object.machine_type = machine_type if machine_type.present? # override :machine_type if specified

    if params_object.valid?
      # launch DE job
      job = IngestJob.new(study: study, study_file: cluster_file, user: user, action: :differential_expression,
                          params_object: params_object)
      job.delay.push_remote_and_launch_ingest(skip_push: true) # skip push as file is already in bucket
      true
    else
      raise ArgumentError, "job parameters failed to validate: #{params_object.errors.full_messages}"
    end
  end

  # validate annotation exists and can be visualized for a DE job
  #
  # * *params*
  #   - +cluster_file+      (StudyFile) => Clustering file being used as control cell list
  #   - +study+            (Study) => Study to which StudyFile belongs
  #   - +annotation_name+  (String) => Name of requested annotation
  #   - +annotation_scope+ (String) => Scope of requested annotation ('study' or 'cluster')
  #
  # * *raises*
  #   - (ArgumentError) => if requested parameters do not validate
  def self.validate_annotation(cluster_file, study, annotation_name, annotation_scope)
    cluster = study.cluster_groups.by_name(cluster_file.name)
    raise ArgumentError, "cannot find cluster for #{cluster_file.name}" if cluster.nil?

    if DifferentialExpressionResult.where(study: study,
                                          cluster_group: cluster,
                                          annotation_name: annotation_name,
                                          annotation_scope: annotation_scope).exists?
      raise ArgumentError,
            "#{annotation_name} already exists for #{study.accession}:#{cluster_file.name}, " \
            'please delete the existing results before retrying'
    end

    can_visualize = false
    if annotation_scope == 'cluster'
      annotation = cluster.cell_annotations&.detect do |annot|
        annot[:name] == annotation_name && annot[:type] == 'group'
      end
      can_visualize = annotation && cluster.can_visualize_cell_annotation?(annotation)
    else
      annotation = study.cell_metadata.by_name_and_type(annotation_name, 'group')
      can_visualize = annotation&.can_visualize?
    end

    identifier = "#{annotation_name}--group--#{annotation_scope}"
    raise ArgumentError, "#{identifier} is not present or is numeric-based" if annotation.nil?
    raise ArgumentError, "#{identifier} cannot be visualized" unless can_visualize

    # last, validate that the requested annotation & cluster will provide a valid intersection of annotation values
    # specifically, discard any annotation/cluster combos that only result in one distinct label
    cells_by_label = ClusterVizService.cells_by_annotation_label(cluster, annotation_name, annotation_scope)
    if cells_by_label.keys.count < 2
      raise ArgumentError, "#{identifier} does not have enough labels represented in #{cluster.name}"
    end
  end

  # validate a given study is able to run DE job
  #
  # * *params*
  #   - +study+ (Study) => Study to validate
  #
  # * *raises*
  #   - (ArgumentError) => If requested study is not eligible for DE
  def self.validate_study(study)
    raise ArgumentError, 'Requested study does not exist' if study.nil?
    raise ArgumentError, "#{study.accession} is not public" unless study.public?
    raise ArgumentError, "#{study.accession} cannot view cluster plots" unless study.can_visualize_clusters?
  end

  # shortcut to log to STDOUT and Rails log simultaneously
  def self.log_message(message)
    puts message
    Rails.logger.info message
  end
end
