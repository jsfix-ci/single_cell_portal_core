module Api
  module V1
    class BulkDownloadController < ApiBaseController
      include Concerns::Authenticator
      include Swagger::Blocks

      before_action :authenticate_api_user!

      DEFAULT_BULK_FILE_TYPES = ['Cluster', 'Metadata', 'Expression Matrix', 'MM Coordinate Matrix', '10X Genes File', '10X Barcodes File']

      swagger_path '/bulk_download/auth_code' do
        operation :post do
          key :tags, [
              'Search'
          ]
          key :summary, 'Create one-time auth code for downloads'
          key :description, 'Create and return a one-time authorization code (OTAC) to identify a user for bulk downloads'
          key :operationId, 'bulk_download_auth_code_path'
          response 200 do
            key :description, 'One-time auth code and time interval, in seconds'
            schema do
              property :auth_code do
                key :type, :integer
                key :description, 'One-time auth code'
              end
              property :time_interval do
                key :type, :integer
                key :description, 'Time interval (in seconds) OTAC will be valid'
              end
            end
          end
          response 401 do
            key :description, ApiBaseController.unauthorized
          end
          response 406 do
            key :description, ApiBaseController.not_acceptable
          end
        end
      end

      def auth_code
        half_hour = 1800 # seconds
        totat = current_api_user.create_totat(half_hour, api_v1_bulk_download_generate_curl_config_path)
        auth_code_response = {auth_code: totat[:totat], time_interval: totat[:totat_info][:valid_seconds]}
        render json: auth_code_response
      end

      swagger_path '/bulk_download/summary_info' do
        operation :get do
          key :tags, [
              'Search'
          ]
          key :summary, 'Summary information of studies requested for download'
          key :description, 'Preview of the names, number of files and bytes (by file type) requested for download from search results'
          key :operationId, 'search_bulk_download_info_path'
          parameter do
            key :name, :accessions
            key :type, :string
            key :in, :query
            key :description, 'Comma-delimited list of Study accessions'
            key :required, true
          end
          response 200 do
            key :description, 'Information about total number of files and sizes by type'
            key :type, :object
            key :title, 'FileSizesByType'
            schema do
              StudyFile::BULK_DOWNLOAD_TYPES.each do |file_type|
                property file_type do
                  key :type, :object
                  key :title, file_type
                  key :description, "#{file_type} files"
                  property :total_files do
                    key :type, :integer
                    key :description, "Number of #{file_type} files"
                  end
                  property :total_bytes do
                    key :type, :integer
                    key :description, "Total number of bytes for #{file_type} files"
                  end
                end
              end
            end
          end
          response 400 do
            key :description, 'Invalid study accessions or requested file types'
          end
          response 406 do
            key :description, ApiBaseController.not_acceptable
          end
        end
      end

      def summary
        # sanitize study accessions and file types
        valid_accessions = self.class.find_matching_accessions(params[:accessions])

        begin
          self.class.check_accession_permissions(valid_accessions, current_api_user)
        rescue ArgumentError => e
          render json: e.message, status: 403 and return
        end

        @study_file_info = ::BulkDownloadService.get_download_info(valid_accessions)

        render json: @study_file_info
      end

      swagger_path '/bulk_download/generate_curl_config' do
        operation :get do
          key :tags, [
              'Search'
          ]
          key :summary, 'Get curl command file for bulk file download'
          key :description, 'Generates a curl config file for downloading files in bulk of multiple types. Specify either study accessions and types, or file ids'
          key :operationId, 'bulk_download_generate_curl_config_path'
          parameter do
            key :name, :auth_code
            key :type, :integer
            key :in, :query
            key :description, 'User-specific one-time authorization code'
            key :required, true
          end
          parameter do
            key :name, :accessions
            key :type, :string
            key :in, :query
            key :description, 'Comma-delimited list of Study accessions'
            key :required, true
          end
          parameter do
            key :name, :file_types
            key :in, :query
            key :description, 'Comma-delimited list of file types'
            key :required, false
            key :type, :array
            items do
              key :type, :string
              key :enum, StudyFile::BULK_DOWNLOAD_TYPES
            end
            key :collectionFormat, :csv
          end
          parameter do
            key :name, :file_ids
            key :in, :query
            key :description, 'Comma-delimited list of file ids'
            key :required, false
            key :type, :array
            items do
              key :type, :string
            end
            key :collectionFormat, :csv
          end
          parameter do
            key :name, :directory
            key :type, :string
            key :in, :query
            key :description, 'Name of directory folder to download (for single-study bulk download only), can be "all"'
            key :required, false
          end
          response 200 do
            key :description, 'Curl configuration file with signed URLs for requested data'
            key :type, :string
          end
          response 400 do
            key :description, 'Invalid study accessions or requested file types'
          end
          response 401 do
            key :description, ApiBaseController.unauthorized
          end
          response 403 do
            key :description, ApiBaseController.forbidden('download with provided auth_token, or download exceeds user quota')
            schema do
              key :title, 'Error'
              property :message do
                key :type, :string
                key :description, 'Error message'
              end
            end
          end
          response 406 do
            key :description, ApiBaseController.not_acceptable
          end
        end
      end

      def generate_curl_config
        valid_accessions = []
        file_ids = []
        # sanitize study accessions and file types
        if params[:file_ids]
          begin
            file_ids = RequestUtils.validate_id_list(params[:file_ids])
          rescue ArgumentError
            render json: {error: 'file_ids must be comma-delimited list of 24-character UUIDs'}, status: 400 and return
          end
          matched_study_ids = StudyFile.where(:id.in => file_ids).pluck(:study_id)
          valid_accessions = Study.where(:id.in => matched_study_ids).pluck(:accession)
        else
          valid_accessions = self.class.find_matching_accessions(params[:accessions])
          sanitized_file_types = self.class.find_matching_file_types(params[:file_types])
        end
        begin
          self.class.check_accession_permissions(valid_accessions, current_api_user)
        rescue ArgumentError => e
          render json: e.message, status: 403 and return
        end

        # if this is a single-study download, allow for DirectoryListing downloads
        if valid_accessions.size == 1 && params[:directory].present?
          study_accession = valid_accessions.first
          directories = self.class.find_matching_directories(params[:directory], study_accession)
          directory_files = ::BulkDownloadService.get_requested_directory_files(directories)
        else
          directories = []
          directory_files = []
        end

        files_requested = nil
        # get requested files
        # reference BulkDownloadService as ::BulkDownloadService to avoid NameError when resolving reference
        if params[:file_ids]
          files_requested = StudyFile.where(:id.in => file_ids)
        else
          files_requested = ::BulkDownloadService.get_requested_files(file_types: sanitized_file_types,
                                                                      study_accessions: valid_accessions)
        end

        # determine quota impact & update user's download quota
        # will throw a RuntimeError if the download exceeds the user's daily quota
        begin
          ::BulkDownloadService.update_user_download_quota(user: current_api_user, files: files_requested, directories: directories)
        rescue RuntimeError => e
          render json: {error: e.message}, status: 403 and return
        end

        # create maps to avoid Mongo timeouts when generating curl commands in parallel processes
        bucket_map = ::BulkDownloadService.generate_study_bucket_map(valid_accessions)
        pathname_map = ::BulkDownloadService.generate_output_path_map(files_requested, directories)

        # generate curl config file
        logger.info "Beginning creation of curl configuration for user_id, auth token: #{current_api_user.id}"
        start_time = Time.zone.now
        @configuration = ::BulkDownloadService.generate_curl_configuration(study_files: files_requested,
                                                                           directory_files: directory_files,
                                                                           user: current_api_user,
                                                                           study_bucket_map: bucket_map,
                                                                           output_pathname_map: pathname_map)
        end_time = Time.zone.now
        runtime = TimeDifference.between(start_time, end_time).humanize
        logger.info "Curl configs generated for studies #{valid_accessions}, #{files_requested.size + directory_files.size} total files"
        logger.info "Total time in generating curl configuration: #{runtime}"
        send_data @configuration, type: 'text/plain', filename: 'cfg.txt'
      end

      private

      def self.check_accession_permissions(valid_accessions, user)
        if valid_accessions.blank?
          raise ArgumentError, 'Invalid request parameters; study accessions not found'
        end
        accessions_by_permission = ::BulkDownloadService.get_permitted_accessions(study_accessions: valid_accessions,
                                                                                  user: user)
        if accessions_by_permission[:forbidden].any? || accessions_by_permission[:lacks_acceptance].any?
          error_msg = "Forbidden: cannot access one or more requested studies for download. "
          if accessions_by_permission[:forbidden].any?
            error_msg += "You do not have permission to view #{accessions_by_permission[:forbidden].join(', ')}"
          end
          if accessions_by_permission[:lacks_acceptance].any?
            error_msg += "#{accessions_by_permission[:lacks_acceptance].join(', ')} require accepting a download agreement that can be found by viewing that study and going to the 'Download' tab"
          end
          raise ArgumentError, error_msg
        end
      end

      # find valid StudyAccessions from query parameters
      # only returns accessions currently in use
      def self.find_matching_accessions(raw_accessions)
        accessions = RequestUtils.split_query_param_on_delim(parameter: raw_accessions)
        sanitized_accessions = StudyAccession.sanitize_accessions(accessions)
        Study.where(:accession.in => sanitized_accessions).pluck(:accession)
      end

      # find valid bulk download types from query parameters
      def self.find_matching_file_types(raw_file_types)
        file_types = RequestUtils.split_query_param_on_delim(parameter: raw_file_types)
        if file_types.count > 0
          return StudyFile::BULK_DOWNLOAD_TYPES & file_types # find array intersection
        end
        # default is return all types
        DEFAULT_BULK_FILE_TYPES
      end

      # find matching directories in a given study
      # this only works for single-study bulk download, not from advanced/faceted search
      # can be 'all', or a single directory
      def self.find_matching_directories(directory_name, accession)
        study = Study.find_by(accession: accession)
        sanitized_dirname = URI.decode(directory_name)
        selector = DirectoryListing.where(study_id: study.id, sync_status: true)
        if sanitized_dirname.downcase != 'all'
          selector = selector.where(name: sanitized_dirname)
        end
        selector
      end
    end
  end
end