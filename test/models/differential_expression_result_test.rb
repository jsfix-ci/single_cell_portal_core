require 'test_helper'

class DifferentialExpressionResultTest  < ActiveSupport::TestCase

  before(:all) do
    @user = FactoryBot.create(:user, test_array: @@users_to_clean)
    @study = FactoryBot.create(:study,
                               name_prefix: 'DifferentialExpressionResult Test',
                               user: @user,
                               test_array: @@studies_to_clean)
    @cells = %w[A B C D E F G]
    @coordinates = 1.upto(7).to_a
    @species = %w[dog cat dog dog cat cat cat]
    @diseases = %w[measles measles measles none none measles measles]
    @library_preparation_protocol = Array.new(7, "10X 5' v3")
    @raw_matrix = FactoryBot.create(:expression_file,
                                    name: 'raw.txt',
                                    study: @study,
                                    expression_file_info: {
                                      is_raw_counts: true,
                                      units: 'raw counts',
                                      library_preparation_protocol: 'Drop-seq',
                                      biosample_input_type: 'Whole cell',
                                      modality: 'Proteomic'
                                    })
    @cluster_file = FactoryBot.create(:cluster_file,
                                      name: 'cluster_diffexp.txt',
                                      study: @study,
                                      cell_input: {
                                        x: @coordinates,
                                        y: @coordinates,
                                        cells: @cells
                                      },
                                      annotation_input: [
                                        { name: 'disease', type: 'group', values: @diseases },
                                        { name: 'sub-cluster', type: 'group', values: %w[1 1 1 2 2 2 2] }
                                      ])
    @cluster_group = ClusterGroup.find_by(study: @study, study_file: @cluster_file)

    @metadata_file = FactoryBot.create(:metadata_file,
                                       name: 'metadata.txt',
                                       study: @study,
                                       cell_input: @cells,
                                       annotation_input: [
                                         { name: 'species', type: 'group', values: @species },
                                         {
                                           name: 'library_preparation_protocol',
                                           type: 'group',
                                           values: @library_preparation_protocol
                                         }
                                       ])

    @species_result = DifferentialExpressionResult.create(
      study: @study, cluster_group: @cluster_file.cluster_groups.first, annotation_name: 'species',
      annotation_scope: 'study', matrix_file_id: @raw_matrix.id
    )

    @disease_result = DifferentialExpressionResult.create(
      study: @study, cluster_group: @cluster_file.cluster_groups.first, annotation_name: 'disease',
      annotation_scope: 'cluster', matrix_file_id: @raw_matrix.id
    )
  end

  after(:all) do
    # prevent issues in CI re: Google::Cloud::PermissionDeniedError when study bucket is removed before DB cleanup
    DifferentialExpressionResult.delete_all
    @study.reload
  end

  test 'should validate DE results and set observed values' do
    assert @species_result.valid?
    assert_equal %w[cat dog], @species_result.observed_values.sort
    assert_equal @cluster_group.name, @species_result.cluster_name

    assert @disease_result.valid?
    assert_equal %w[measles none], @disease_result.observed_values.sort
    assert_equal @cluster_group.name, @disease_result.cluster_name

    library_result = DifferentialExpressionResult.new(
      study: @study, cluster_group: @cluster_group, annotation_name: 'library_preparation_protocol',
      annotation_scope: 'study', matrix_file_id: @raw_matrix.id
    )

    assert_not library_result.valid?
  end

  test 'should retrieve source annotation object' do
    assert @species_result.annotation_object.present?
    assert @species_result.annotation_object.is_a?(CellMetadatum)
    assert_equal @species_result.observed_values.sort,
                 @species_result.annotation_object.values.sort

    assert @disease_result.annotation_object.present?
    assert @disease_result.annotation_object.is_a?(Hash) # cell_annotation from ClusterGroup
    assert_equal @disease_result.observed_values.sort, @disease_result.annotation_object[:values].sort
  end

  test 'should return relative bucket pathname for individual label' do
    prefix = "_scp_internal/differential_expression"
    @species_result.observed_values.each do |label|
      expected_filename = "#{prefix}/cluster_diffexp_txt--species--#{label}--study--wilcoxon.tsv"
      assert_equal expected_filename, @species_result.bucket_path_for(label)
    end

    @disease_result.observed_values.each do |label|
      expected_filename = "#{prefix}/cluster_diffexp_txt--disease--#{label}--cluster--wilcoxon.tsv"
      assert_equal expected_filename, @disease_result.bucket_path_for(label)
    end
  end

  test 'should return array of select options for observed outputs' do
    species_opts = {
      dog: 'cluster_diffexp_txt--species--dog--study--wilcoxon.tsv',
      cat: 'cluster_diffexp_txt--species--cat--study--wilcoxon.tsv'
    }.with_indifferent_access

    disease_opts = {
      measles: 'cluster_diffexp_txt--disease--measles--cluster--wilcoxon.tsv',
      none: 'cluster_diffexp_txt--disease--none--cluster--wilcoxon.tsv'
    }.with_indifferent_access

    assert_equal species_opts.to_a, @species_result.select_options
    assert_equal disease_opts.to_a, @disease_result.select_options
  end

  test 'should return associated files' do
    assert_equal @raw_matrix, @species_result.matrix_file
    assert_equal @metadata_file, @species_result.annotation_file
    assert_equal @cluster_file, @species_result.cluster_file
    assert_equal @raw_matrix.upload_file_name, @species_result.matrix_file_name
  end

  test 'should clean up files on destroy' do
    sub_cluster = DifferentialExpressionResult.create(
      study: @study, cluster_group: @cluster_file.cluster_groups.first, annotation_name: 'sub-cluster',
      annotation_scope: 'cluster', matrix_file_id: @raw_matrix.id
    )
    assert sub_cluster.present?
    mock = Minitest::Mock.new
    sub_cluster.bucket_files.each do |file|
      file_mock = Minitest::Mock.new
      file_mock.expect :present?, true
      file_mock.expect :delete, true
      mock.expect :get_workspace_file, file_mock, [@study.bucket_id, file]
    end
    ApplicationController.stub :firecloud_client, mock do
      sub_cluster.destroy
      mock.verify
      assert_not DifferentialExpressionResult.where(study: @study, cluster_group: @cluster_file.cluster_groups.first,
                                                    annotation_name: 'sub-cluster', annotation_scope: 'cluster',
                                                    matrix_file_id: @raw_matrix.id).exists?
    end
  end

  test 'should prevent creating duplicate results' do
    duplicate_result = DifferentialExpressionResult.new(
      study: @study, cluster_group: @cluster_file.cluster_groups.first, annotation_name: 'species',
      annotation_scope: 'study', matrix_file_id: @raw_matrix.id
    )
    assert_not duplicate_result.valid?
    assert_equal [:annotation_name], duplicate_result.errors.attribute_names
  end

  test 'should handle plus sign in output file names' do
    label = 'CD4+'
    expected_filename = 'cluster_diffexp_txt--species--CD4pos--study--wilcoxon.tsv'
    filename = @species_result.filename_for(label)
    assert_equal expected_filename, filename
  end
end
