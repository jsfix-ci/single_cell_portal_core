class FeatureFlagOption
  include Mongoid::Document
  include Mongoid::Timestamps
  include Mongoid::History::Trackable
  field :value, type: Mongoid::Boolean, default: false

  belongs_to :feature_flaggable, polymorphic: true
  belongs_to :feature_flag

  validates :feature_flag, presence: true
  # only allow one FeatureFlagOption per parent model instance & parent FeatureFlag
  validates :feature_flag_id, uniqueness: {
    scope: %i[feature_flaggable_id feature_flaggable_type], message: 'already has an option set for this instance'
  }

  # index declarations
  index({ feature_flaggable_type: 1, feature_flaggable_id: 1, feature_flag_id: 1 }, unique: true)

  # get the default_value, name, and description from parent feature_flag
  delegate :default_value, to: :feature_flag
  delegate :name, to: :feature_flag
  delegate :description, to: :feature_flag

  # get associated model instance that this FeatureFlagOption maps to (e.g. User instance)
  # can call either flag_option.parent or flag_option.feature_flaggable
  alias parent feature_flaggable

  def to_h
    {
      name => value
    }.with_indifferent_access
  end

  # attributes hash, removing created/updated timestamps, and converting all values to strings
  # this is the representation found in form parameters hash objects
  def form_attributes
    sanitized_attributes = {}.with_indifferent_access
    attributes.reject { |attr| attr =~ /_at|version/ }.each do |key, value|
      sanitized_key = key == '_id' ? 'id' : key
      sanitized_attributes[sanitized_key] = value.to_s
    end
    sanitized_attributes
  end

  # history tracking, will also record when option was removed (e.g. manually deleted, or feature flag retired)
  track_history on: %i[value], modifier_field: nil, track_destroy: true
end
