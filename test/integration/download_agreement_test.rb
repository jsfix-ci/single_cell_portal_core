require 'api_test_helper'
require 'test_helper'
require 'includes_helper'

class DownloadAgreementTest < ActionDispatch::IntegrationTest

  before(:all) do
    @user = FactoryBot.create(:admin_user, test_array: @@users_to_clean)
    @study = FactoryBot.create(:study,
                               name_prefix: 'Download Agreement Study',
                               public: true,
                               user: @user,
                               test_array: @@studies_to_clean,
                               predefined_file_types: %w[expression])
    detail = @study.build_study_detail
    detail.full_description = '<p>This is the description.</p>'
    detail.save!
    @study.reload
    @exp_matrix = @study.expression_matrix_files.first
    sign_in_and_update @user
  end

  # we use after(:each) because after(:all) will not have @download_agreement in scope
  after(:each) do
    @download_agreement&.destroy
    @download_acceptance&.destroy
  end

  test 'should enforce download agreement' do
    # ensure normal download works
    get download_file_path(accession: @study.accession,
                           study_name: @study.url_safe_name,
                           filename: @exp_matrix.upload_file_name)
    # since this is an external redirect, we cannot call follow_redirect! but instead have to get the location header
    assert_response 302, "Did not initiate file download as expected; response code: #{response.code}"
    signed_url = response.headers['Location']

    assert signed_url.include?(@exp_matrix.upload_file_name), 'Redirect url does not point at requested file'

    # test bulk download, first by generating and saving user totat.
    totat = @user.create_totat(30, api_v1_bulk_download_generate_curl_config_path)
    execute_http_request(:get,
                         api_v1_bulk_download_generate_curl_config_path(accessions: [@study.accession],
                                                                        auth_code: totat[:totat]),
                         user: @user)
    assert_response :success, 'Did not get curl config for bulk download'

    # enable download agreement, assert 403
    @download_agreement = DownloadAgreement.new(study_id: @study.id, content: 'This is the agreement content')
    @download_agreement.save!

    get download_file_path(accession: @study.accession,
                           study_name: @study.url_safe_name,
                           filename: @exp_matrix.upload_file_name)
    assert_response :forbidden, "Did not correctly respond 403 when download agreement is in place: #{response.code}"
    totat = @user.create_totat(30, api_v1_bulk_download_generate_curl_config_path)
    execute_http_request(:get,
                         api_v1_bulk_download_generate_curl_config_path(accessions: [@study.accession],
                                                                        auth_code: totat[:totat]),
                         user: @user)
    assert_response :forbidden, "Did not correctly respond 403 for bulk download: #{response.code}"
    assert response.body.include?('Download agreement'),
           "Error response did not reference download agreement: #{response.body}"

    # accept agreement and validate downloads resume
    @download_acceptance = DownloadAcceptance.new(email: @user.email, download_agreement: @download_agreement)
    @download_acceptance.save!

    get download_file_path(accession: @study.accession,
                           study_name: @study.url_safe_name,
                           filename: @exp_matrix.upload_file_name)
    assert_response 302, "Did not re-enable file download as expected; response code: #{response.code}"
    signed_url = response.headers['Location']

    assert signed_url.include?(@exp_matrix.upload_file_name), 'Redirect url does not point at requested file'
    totat = @user.create_totat(30, api_v1_bulk_download_generate_curl_config_path)
    execute_http_request(:get,
                         api_v1_bulk_download_generate_curl_config_path(accessions: [@study.accession],
                                                                        auth_code: totat[:totat]),
                         user: @user)
    assert_response :success, 'Did get curl config for bulk download after accepting download agreement'
  end
end
