require 'test_helper'

class UploadCleanupJobTest < ActiveSupport::TestCase

  def setup
    @study = Study.first
  end

  def teardown
    @study.study_files.where(file_type: 'Other').destroy_all
  end

  test 'should automatically remove failed uploads' do
    puts "#{File.basename(__FILE__)}: #{self.method_name}"

    # get starting counts, taking into account upstream tests that have deleted files
    beginning_file_count = StudyFile.where(queued_for_deletion: false).count
    existing_deletes = StudyFile.where(queued_for_deletion: true).pluck(:id)
    # run without any failed uploads to ensure good files aren't removed
    UploadCleanupJob.find_and_remove_failed_uploads
    failed_uploads = StudyFile.where(queued_for_deletion: true, :id.nin => existing_deletes).count
    assert failed_uploads == 0, "Should not have found any failed uploads but found #{failed_uploads}"

    # now simulate a failed upload and prove they are detected
    filename = 'README.txt'
    file = File.open(Rails.root.join('test', 'test_data', filename))
    bad_upload = StudyFile.create!(name: filename, study: @study, file_type: 'Other', upload: file, status: 'uploading',
                                   created_at: 1.week.ago.in_time_zone, parse_status: 'unparsed', generation: nil)
    file.close
    UploadCleanupJob.find_and_remove_failed_uploads
    failed_uploads = StudyFile.where(queued_for_deletion: true, :id.nin => existing_deletes).count
    assert failed_uploads == 1, "Should have found 1 failed upload but found #{failed_uploads}"
    bad_upload.reload
    assert bad_upload.queued_for_deletion, "Did not correctly mark #{bad_upload.name} as failed upload"

    # remove queued deletions
    StudyFile.delete_queued_files
    end_file_count = StudyFile.count
    assert_equal beginning_file_count, end_file_count,
                 "Study file counts do not match after removing failed uploads; #{beginning_file_count} != #{end_file_count}"

    puts "#{File.basename(__FILE__)}: #{self.method_name} successful!"
  end

  test 'should only run cleanup job 3 times on error' do
    puts "#{File.basename(__FILE__)}: #{self.method_name}"

    file = File.open(Rails.root.join('test', 'test_data', 'table_1.xlsx'))
    study_file = StudyFile.create!(study_id: @study.id, file_type: 'Other', upload: file)
    @study.send_to_firecloud(study_file)
    remote = ApplicationController.firecloud_client.get_workspace_file(@study.bucket_id, study_file.bucket_location)
    assert remote.present?, "File did not push to study bucket, no remote found"

    # to cause errors in UploadCleanupJobs, remove file from bucket as this will cause UploadCleanupJob to retry later
    remote.delete
    new_remote = ApplicationController.firecloud_client.get_workspace_file(@study.bucket_id, study_file.bucket_location)
    refute new_remote.present?, "Delete did not succeed, found remote: #{new_remote}"

    # now find delayed_job instance for UploadCleanupJob for this file for each retry and assert only 3 attempts are made
    0.upto(UploadCleanupJob::MAX_RETRIES).each do |retry_count|
      cleanup_jobs = UploadCleanupJob.find_jobs_by_handler_type(UploadCleanupJob, study_file)
      # make sure we're getting the latest job, as the previous may not have fully cleared out of the queue
      latest_job = cleanup_jobs.sort_by(&:created_at).last
      job_handler = UploadCleanupJob.dump_job_handler(latest_job)
      assert job_handler.retry_count == retry_count, "Retry count does not match: #{job_handler.retry_count} != #{retry_count}"
      # to force a job to run, unset :run_at
      # wait until handler is cleared, which indicates job has run and will be garbage collected
      latest_job.update(run_at: nil)
      while latest_job.handler.present?
        latest_job.reload
        sleep 1
      end
    end
    sleep 5 # give queue a chance to fully clear
    cleanup_jobs = UploadCleanupJob.find_jobs_by_handler_type(UploadCleanupJob, study_file)
    refute cleanup_jobs.any?, "Should not have found any cleanup jobs for file but found #{cleanup_jobs.size}"

    # clean up
    study_file.update(remote_location: nil)
    ApplicationController.firecloud_client.delete_workspace_file(@study.bucket_id, study_file.bucket_location)
    study_file.destroy

    puts "#{File.basename(__FILE__)}: #{self.method_name} successful!"
  end

  test 'should load job instance and decode handler' do
    puts "#{File.basename(__FILE__)}: #{self.method_name}"

    study_file = @study.study_files.sample
    run_at = 10.minutes.from_now.in_time_zone
    # queue job
    job = Delayed::Job.enqueue(UploadCleanupJob.new(@study, study_file, 0), run_at: run_at)
    found_job = UploadCleanupJob.find_jobs_by_handler_type(UploadCleanupJob, study_file)
    assert_equal job.id, found_job.id, "Did not get correct instance of UploadCleanupJob; #{job.id} != #{found_job.id}"
    handler = UploadCleanupJob.dump_job_handler(job)
    handler_file_attributes = handler.study_file['attributes']
    assert_equal study_file.attributes, handler_file_attributes, "Study File attributes do not match: #{study_file.attributes} != #{handler_file_attributes}"

    # clean up
    job.destroy

    puts "#{File.basename(__FILE__)}: #{self.method_name} successful!"
  end
end
