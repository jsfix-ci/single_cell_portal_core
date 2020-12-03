require 'api_test_helper'

class ClusterControllerTest < ActionDispatch::IntegrationTest
  include Devise::Test::IntegrationHelpers
  include Requests::JsonHelpers
  include Requests::HttpHelpers

  setup do
    @user = FactoryBot.create(:api_user)
    OmniAuth.config.mock_auth[:google_oauth2] = OmniAuth::AuthHash.new({
                                                                           :provider => 'google_oauth2',
                                                                           :uid => '123545',
                                                                           :email => 'testing.user@gmail.com'
                                                                       })
    sign_in @user
    @user.update_last_access_at! # ensure user is marked as active

    @basic_study = FactoryBot.create(:detached_study, name: 'Basic Cluster Study')
    @basic_study_cluster_file = FactoryBot.create(:cluster_file,
                                                  name: 'clusterA.txt',
                                                  study: @basic_study,
                                                  cell_input: {
                                                     x: [1, 4 ,6],
                                                     y: [7, 5, 3],
                                                     cells: ['A', 'B', 'C']
                                                  },
                                                  annotation_input: [{name: 'foo', type: 'group', values: ['bar', 'bar', 'baz']}])

    @basic_study_metadata_file = FactoryBot.create(:metadata_file,
                                                   name: 'metadata.txt',
                                                   study: @basic_study,
                                                   cell_input: ['A', 'B', 'C'],
                                                   annotation_input: [
                                                     {name: 'species', type: 'group', values: ['dog', 'cat', 'dog']},
                                                     {name: 'disease', type: 'group', values: ['none', 'none', 'measles']}
                                                   ])

     @empty_study = FactoryBot.create(:detached_study, name: 'Empty Cluster Study')
  end

  teardown do
    StudyFile.where(study_id: @basic_study.id).destroy_all
    DataArray.where(study_id: @basic_study.id).destroy_all
    ClusterGroup.where(study_id: @basic_study.id).destroy_all
    CellMetadatum.where(study_id: @basic_study.id).destroy_all
    @basic_study.destroy
    @empty_study.destroy
    @user.destroy
  end

  test 'should get basic cluster, with metadata annotation by default' do
    puts "#{File.basename(__FILE__)}: #{self.method_name}"


    assert_equal 4, @basic_study.default_cluster.data_arrays.count

    execute_http_request(:get, api_v1_study_clusters_path(@basic_study))
    assert_equal 3, json['numPoints']
    assert_equal ["cat (1 points)", "dog (2 points)"], json['data'].map{|d| d['name']}

    puts "#{File.basename(__FILE__)}: #{self.method_name} successful!"
  end

  test 'should 404 with no default cluster' do
    puts "#{File.basename(__FILE__)}: #{self.method_name}"

    execute_http_request(:get, api_v1_study_clusters_path(@empty_study))
    assert_equal 404, response.status
    assert_equal({"error"=>"No default cluster exists"}, json)

    puts "#{File.basename(__FILE__)}: #{self.method_name} successful!"
  end

  test 'should load clusters with slashes in name' do
    puts "#{File.basename(__FILE__)}: #{self.method_name}"

    @cluster_with_slash = FactoryBot.create(:cluster_file,
                                            name: 'data/cluster_with_slash.txt',
                                            study: @basic_study,
                                            cell_input: {
                                              x: [1, 2 , 3, 4],
                                              y: [5, 6, 7, 8],
                                              cells: %w(A B C D)
                                            },
                                            annotation_input: [{name: 'category', type: 'group', values: ['bar', 'bar', 'baz', 'bar']}])

    # slash must be URL encoded with %2F, and URL constructed manually as the path helper cannot resolve cluster_name param
    # with a slash due to the route constraint of {:cluster_name=>/[^\/]+/}; using route helper api_v1_study_cluster_path()
    # with the params of cluster_name: 'data/cluster_with_slash.txt' or cluster_name: 'data%2Fcluster_with_slash' does not work
    cluster_name = 'data%2Fcluster_with_slash.txt'
    basepath = "/single_cell/api/v1/studies/#{@basic_study.accession}/clusters/#{cluster_name}"
    query_string = '?annotation_name=category&annotation_type=group&annotation_scope=cluster'
    url = basepath + query_string
    execute_http_request(:get, url)
    assert_response :success
    assert_equal 4, json['numPoints']
    expected_annotations = ["bar (3 points)", "baz (1 points)"]
    loaded_annotations = json['data'].map {|d| d['name'] }
    assert_equal expected_annotations, loaded_annotations

    # assert that non-encoded cluster names do not load correct cluster
    # using path helper here results in cluster_name not being decoded properly by clusters_controller.rb
    # and is interpreted literally as data%2Fcluster_with_slash.txt, rather than data/cluster_with_slash.txt
    execute_http_request(:get, api_v1_study_cluster_path(@basic_study.accession, cluster_name,
                                                         annotation_name: 'category', annotation_type: 'group',
                                                         annotation_scope: 'cluster'))
    assert_response :not_found
    expected_error = {"error"=>"No cluster named data%2Fcluster_with_slash.txt could be found"}
    assert_equal expected_error, json

    puts "#{File.basename(__FILE__)}: #{self.method_name} successful!"
  end
end
