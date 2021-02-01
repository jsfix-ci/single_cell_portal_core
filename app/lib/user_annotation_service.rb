class UserAnnotationService
  # Methods to interact with annotation data, beyond just visualization

  def self.create_user_annotation(study, name,
    user_data_arrays_attributes, cluster_name, loaded_annotation,
    subsample_threshold, current_user)

    user_id = current_user.id

    cluster_group_id = study.cluster_groups.find_by(name: cluster_name).id

    study_id = study[:id]

    # Data name is an array of the values of labels
    data_names = []

    begin

      # Get the label values and push to data names
      user_data_arrays_attributes.keys.each do |key|
        data_names.push(user_data_arrays_attributes[key][:name].strip)
      end

      source_resolution = subsample_threshold.present? ? subsample_threshold.to_i : nil

      # Create the annotation
      user_annotation = UserAnnotation.new(user_id: user_id, study_id: study_id,
                                            cluster_group_id: cluster_group_id,
                                            values: data_names, name: name,
                                            source_resolution: source_resolution)

      # override cluster setter to use the current selected cluster, needed for reloading
      cluster = user_annotation.cluster_group

      # Save the user annotation, and handle any exceptions
      if user_annotation.save!

        # Consider refactoring user_annotation_test.rb and
        # models/user_annotation.rb to remove `subsample_annotation`.  Jon
        # and Eric investigated on 2021-01-22 and determined that there are no
        # known use cases where `subsample_annotation` != `loaded_annotation`.
        subsample_annotation = loaded_annotation

        # Method call to create the user data arrays for this annotation
        user_annotation.initialize_user_data_arrays(user_data_arrays_attributes, subsample_annotation, subsample_threshold, loaded_annotation)

        # Reset the annotations in the dropdowns to include this new annotation
        cluster_annotations = ClusterVizService.load_cluster_group_annotations(study, cluster, current_user)

        message = "User Annotation: '#{user_annotation.name}' successfully saved. You may now view this annotation via the annotations dropdown."
        status = 200 # Success
      else
        # If there was an error saving, alert the user something broke
        cluster_annotations = ClusterVizService.load_cluster_group_annotations(study, cluster, current_user)
        message = 'The following errors prevented the annotation from being saved: ' + user_annotation.errors.full_messages.join(',')
        status = 400  # Bad request
      end
      [message, cluster_annotations, status]

    end
  end
end
