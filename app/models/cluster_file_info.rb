class ClusterFileInfo
  include Mongoid::Document

  embedded_in :study_file

  field :custom_colors, type: String

  # hash of annotation names to booleans of whether the annotation should, by default, be shown split
  # on pipes (assuming it is array-based).  Unspecified is treated as false by the front end
  field :annotation_split_defaults, type: String

  before_save :stringify_hashes

  # decode string back to Hash
  def custom_colors_as_hash
    ActiveSupport::JSON.decode(custom_colors || '{}')
  end

   # decode string back to Hash
   def annotation_split_defaults_as_hash
    ActiveSupport::JSON.decode(annotation_split_defaults || '{}')
  end

  # This is called before the data is saved to the DB to ensure the file hashes are encoded as JSON strings
  # This is necessary to work around MongoDBs constraints on '.' and '$' in hash keys
  def stringify_hashes
    if self.custom_colors.is_a?(Hash)
      self.custom_colors = ActiveSupport::JSON.encode(custom_colors)
    end
    if self.annotation_split_defaults.is_a?(Hash)
      self.annotation_split_defaults = ActiveSupport::JSON.encode(annotation_split_defaults)
    end
    # because these fields have type String, Rails may have already auto-converted a hash using .to_s,
    # in which case it will have Ruby-style => in it.  But we want it as json.
    self.custom_colors = custom_colors&.gsub('=>', ':')
    self.annotation_split_defaults = annotation_split_defaults&.gsub('=>', ':')
  end

  # merges in a color update to the custom_colors hash
  # all colors for the given annotations will be overwritten,
  # but annotations not listed in update_colors will be unchanged
  # e.g. if custom_colors = {
  #  'annot1': {'label1': '#ee1166'},
  #  'annot2': {'foo': '#336677'}
  # }
  # merge_color_updates(file, { 'annot1': { 'label2': '#334499'}}) will delete the prior custom color for label1
  # but will leave the entry for 'annot2' unchanged.
  def self.merge_color_updates(study_file, update_colors)
    previous_colors = study_file.cluster_file_info&.custom_colors_as_hash || {}

    # Consider validating that values are valid color hex codes, etc...
    previous_colors.merge(update_colors)
  end
end
