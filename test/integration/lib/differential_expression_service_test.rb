require 'test_helper'

class DifferentialExpressionServiceTest < ActiveSupport::TestCase

  before(:all) do
    @user = FactoryBot.create(:api_user, test_array: @@users_to_clean)
    @basic_study = FactoryBot.create(:detached_study,
                                     name_prefix: 'DifferentialExpressionService Test',
                                     user: @user,
                                     test_array: @@studies_to_clean)

    @cells = %w[A B C D E]
    @raw_matrix = FactoryBot.create(:expression_file,
                                   name: 'raw.txt',
                                   study: @basic_study,
                                   expression_file_info: {
                                     is_raw_counts: true,
                                     units: 'raw counts',
                                     library_preparation_protocol: 'Drop-seq',
                                     biosample_input_type: 'Whole cell',
                                     modality: 'Proteomic'
                                   })
    @cluster_file = FactoryBot.create(:cluster_file,
                                     name: 'cluster_diffexp.txt',
                                     study: @basic_study,
                                     cell_input: {
                                       x: [1, 4, 6, 8, 9],
                                       y: [7, 5, 3, 2, 1],
                                       cells: @cells
                                     },
                                     annotation_input: [
                                       {
                                         name: 'foo', type: 'group', values: %w[bar bar baz baz baz],
                                         is_differential_expression_enabled: false
                                       }
                                     ])
    FactoryBot.create(:metadata_file,
                      name: 'metadata.txt',
                      study: @basic_study,
                      cell_input: @cells,
                      annotation_input: [
                        { name: 'species', type: 'group', values: %w[dog cat dog dog cat] },
                        { name: 'disease', type: 'group', values: %w[none none measles measles measles] }
                      ])
    @job_params = {
      annotation_name: 'species',
      annotation_scope: 'study'
    }
    @basic_study.update(initialized: true)

    # parameters for creating "all cells" array, since this needs to be created/destroyed after every run
    @all_cells_array_params = {
      name: 'raw.txt Cells', array_type: 'cells', linear_data_type: 'Study', study_id: @basic_study.id,
      cluster_name: 'raw.txt', array_index: 0, linear_data_id: @basic_study.id, study_file_id: @raw_matrix.id,
      cluster_group_id: nil, subsample_annotation: nil, subsample_threshold: nil, values: @cells
    }
  end

  teardown do
    DataArray.find_by(@all_cells_array_params)&.destroy
    @basic_study.differential_expression_results.destroy_all
  end

  test 'should validate parameters and launch differential expression job' do
    # should fail on annotation missing
    assert_raise ArgumentError do
      DifferentialExpressionService.run_differential_expression_job(
        @cluster_file, @basic_study, @user, annotation_name: 'NA', annotation_scope: 'study'
      )
    end

    # should fail on cell validation
    assert_raise ArgumentError do
      DifferentialExpressionService.run_differential_expression_job(@cluster_file, @basic_study, @user, **@job_params)
    end
    # test launch by manually creating expression matrix cells array for validation
    DataArray.create!(@all_cells_array_params)

    # we need to mock 2 levels deep as :delay should yield the :push_remote_and_launch_ingest mock
    job_mock = Minitest::Mock.new
    job_mock.expect(:push_remote_and_launch_ingest, Delayed::Job.new)
    mock = Minitest::Mock.new
    mock.expect(:delay, job_mock)
    IngestJob.stub :new, mock do
      job_launched = DifferentialExpressionService.run_differential_expression_job(
        @cluster_file, @basic_study, @user, **@job_params
      )
      assert job_launched
      mock.verify
      job_mock.verify
    end
  end

  test 'should run differential expression job with sparse matrix' do
    study = FactoryBot.create(:detached_study,
                              name_prefix: 'Sparse DE Test',
                              user: @user,
                              test_array: @@studies_to_clean)

    cells = %w[Cell_A Cell_B Cell_C Cell_D Cell_E]
    matrix = FactoryBot.create(:study_file,
                               name: 'raw.txt',
                               study: study,
                               file_type: 'MM Coordinate Matrix',
                               parse_status: 'parsed',
                               status: 'uploaded',
                               expression_file_info: {
                                 is_raw_counts: true,
                                 units: 'raw counts',
                                 library_preparation_protocol: 'Drop-seq',
                                 biosample_input_type: 'Whole cell',
                                 modality: 'Proteomic'
                               })

    genes = FactoryBot.create(:study_file,
                              name: 'genes.txt',
                              study: study,
                              status: 'uploaded',
                              file_type: '10X Genes File')

    barcodes = FactoryBot.create(:study_file,
                                 name: 'barcodes.txt',
                                 study: study,
                                 status: 'uploaded',
                                 file_type: '10X Barcodes File')

    bundle = StudyFileBundle.new(study: study, bundle_type: matrix.file_type)
    bundle.add_files(matrix, genes, barcodes)
    bundle.save!
    cluster_file = FactoryBot.create(:cluster_file,
                                    name: 'cluster_diffexp.txt',
                                    study: study,
                                    cell_input: {
                                      x: [1, 4, 6, 7, 9],
                                      y: [7, 5, 3, 4, 5],
                                      cells: cells
                                    })
    FactoryBot.create(:metadata_file,
                      name: 'metadata.txt',
                      study: study,
                      cell_input: cells,
                      annotation_input: [
                        { name: 'species', type: 'group', values: %w[dog cat dog dog cat] },
                        { name: 'disease', type: 'group', values: %w[none none measles measles measles] }
                      ])
    annotation = {
      annotation_name: 'species',
      annotation_scope: 'study'
    }

    data_array_params = {
      name: 'raw.txt Cells', array_type: 'cells', linear_data_type: 'Study', study_id: study.id,
      cluster_name: 'raw.txt', array_index: 0, linear_data_id: study.id, study_file_id: matrix.id,
      cluster_group_id: nil, subsample_annotation: nil, subsample_threshold: nil, values: cells
    }
    DataArray.create(data_array_params)

    job_mock = Minitest::Mock.new
    job_mock.expect(:push_remote_and_launch_ingest, Delayed::Job.new)
    mock = Minitest::Mock.new
    mock.expect(:delay, job_mock)
    IngestJob.stub :new, mock do
      job_launched = DifferentialExpressionService.run_differential_expression_job(
        cluster_file, study, @user, **annotation
      )
      assert job_launched
      mock.verify
      job_mock.verify
    end
  end

  test 'should run differential expression job on study defaults' do
    # test validation
    @basic_study.update(default_options: {})
    assert_raise ArgumentError do
      DifferentialExpressionService.run_differential_expression_job(@cluster_file, @basic_study, @user, **@job_params)
    end

    @basic_study.update(default_options: { cluster: 'cluster_diffexp.txt', annotation: 'species--group--study' })
    DataArray.create!(@all_cells_array_params)
    job_mock = Minitest::Mock.new
    job_mock.expect(:push_remote_and_launch_ingest, Delayed::Job.new)
    mock = Minitest::Mock.new
    mock.expect(:delay, job_mock)
    IngestJob.stub :new, mock do
      job_launched = DifferentialExpressionService.run_differential_expression_on_default(@basic_study.accession)
      assert job_launched
      mock.verify
      job_mock.verify
    end
  end

  test 'should not run differential expression job if dry run' do
    DataArray.create!(@all_cells_array_params)
    params = {
      annotation_name: 'species',
      annotation_scope: 'study',
      dry_run: true
    }

    job_requested = DifferentialExpressionService.run_differential_expression_job(@cluster_file, @basic_study, @user, **params)
    assert job_requested
    assert_equal [], DelayedJobAccessor.find_jobs_by_handler_type(IngestJob, @cluster_file)
  end

  test 'should run differential expression job on all annotations' do
    DataArray.create!(@all_cells_array_params)
    job_mock = Minitest::Mock.new
    job_mock.expect(:push_remote_and_launch_ingest, Delayed::Job.new)
    job_mock.expect(:push_remote_and_launch_ingest, Delayed::Job.new)
    job_mock.expect(:push_remote_and_launch_ingest, Delayed::Job.new)
    mock = Minitest::Mock.new
    mock.expect(:delay, job_mock)
    mock.expect(:delay, job_mock)
    mock.expect(:delay, job_mock)
    IngestJob.stub :new, mock do
      jobs_launched = DifferentialExpressionService.run_differential_expression_on_all(@basic_study.accession)
      assert_equal 3, jobs_launched
      mock.verify
      job_mock.verify
    end
  end

  test 'should find existing DE results' do
    cluster = @basic_study.cluster_groups.by_name(@cluster_file.name)
    annotation = { annotation_name: 'species', annotation_scope: 'study' }
    result = DifferentialExpressionResult.create(
      study: @basic_study, cluster_group: cluster, matrix_file_id: @raw_matrix.id, cluster_name: cluster.name,
      annotation_name: 'species', annotation_scope: 'study', computational_method: 'wilcoxon',
      observed_values: %w[dog cat]
    )
    assert result.present?
    @basic_study.reload
    assert DifferentialExpressionService.results_exist?(@basic_study, annotation)
    no_results = { annotation_name: 'foo', annotation_scope: 'cluster', cluster_group_id: cluster.id }
    assert_not DifferentialExpressionService.results_exist?(@basic_study, no_results)
  end

  test 'should find eligible annotations' do
    cluster = @basic_study.cluster_groups.by_name(@cluster_file.name)
    annot = cluster.cell_annotations.first
    expected_annotations = [
      { annotation_name: 'species', annotation_scope: 'study' },
      { annotation_name: 'disease', annotation_scope: 'study' },
      { annotation_name: 'foo', annotation_scope: 'cluster', cluster_file_id: @cluster_file.id }
    ]
    eligible_annotations = DifferentialExpressionService.find_eligible_annotations(@basic_study)
    assert_equal expected_annotations.count, eligible_annotations.count
    expected_annotations.each do |annotation|
      assert_includes eligible_annotations, annotation
    end
  end

  test 'should determine study eligibility' do
    assert DifferentialExpressionService.study_eligible?(@basic_study)
    empty_study = FactoryBot.create(:detached_study,
                                    name_prefix: 'Empty Test',
                                    user: @user,
                                    test_array: @@studies_to_clean)
    assert_not DifferentialExpressionService.study_eligible?(empty_study)
  end
end
