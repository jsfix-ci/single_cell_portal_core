##
# FeatureFlaggable: a module to add functionality for supporting "feature_flags" for a given model, used to turn on/off
# special features in a sandboxed fashion
##
module FeatureFlaggable
  extend ActiveSupport::Concern

  # associations via FeatureFlagOptions model
  included do
    has_many :feature_flag_options, as: :feature_flaggable, dependent: :delete_all
    accepts_nested_attributes_for :feature_flag_options, allow_destroy: true
  end

  # get specific feature_flag_option value for this instance
  # will fall back to default_value of parent FeatureFlag if no feature_flag_option is present
  #
  # * *params*
  #   - +flag_name+ (String) => name of feature flag
  #
  # * *returns*
  #   - (Boolean, Nilclass) => T/F if set, nil if no configured option or flag does not exist
  def feature_flag_for(flag_name)
    opt = get_flag_option(flag_name)
    opt.present? ? opt.value : FeatureFlag.find_by(name: flag_name)&.default_value
  end

  # return feature flag as Hash, with name & value for this instance
  #
  # * *params*
  #   - +flag_name+ (String) => name of feature flag
  #
  # * *returns*
  #   - (Hash, Nilclass) => Hash of flag if set, nil if no configured option or flag does not exist
  def feature_flag_as_hash(flag_name)
    if FeatureFlag.where(name: flag_name).exists?
      {
        flag_name.to_s => feature_flag_for(flag_name)
      }.with_indifferent_access
    end
  end

  # return requested feature_flag_option values for this instance
  # will supply defaults if not configured
  #
  # * *params*
  #   - +flag_names+ (Array<String>) => Array of feature flag names
  #
  # * *returns*
  #   - (Hash) => Hash of requested feature flags (if present)
  def feature_flags_for(*flag_names)
    flags = {}
    flag_names.each do |flag_name|
      flags.merge!(feature_flag_as_hash(flag_name))
    end
    flags.with_indifferent_access
  end

  # return only configured feature_flag_options for this instance
  # will not interpolate defaults - only returns configured values
  #
  # * *returns*
  #   - (Hash) => Hash of all configured options, w/o defaults
  def configured_feature_flags
    feature_flag_options.sort_by(&:name).map(&:to_h).reduce({}, :merge).with_indifferent_access
  end

  # merges the user flags with the defaults
  # this is the most authoritative method for determining whether to enable a feature for a given model instance
  #
  # * *returns*
  #   - (Hash) => Hash of all feature flag values w/ configured values overriding defaults
  def feature_flags_with_defaults
    flag_names = FeatureFlag.pluck(:name).sort
    FeatureFlag.default_flag_hash.merge(feature_flags_for(*flag_names)).with_indifferent_access
  end

  # check if a given feature flag is configured for this instance
  #
  # * *params*
  #   - +feature_flag+ (FeatureFlag) => FeatureFlag to check for configured option on instance
  #
  # * *returns*
  #   - (Boolean) => T/F if FeatureFlagOption exists for this instance/feature flag
  def flag_configured?(feature_flag)
    FeatureFlagOption.where(feature_flag_id: feature_flag.id, feature_flaggable_type: self.class.name,
                            feature_flaggable_id: self.id).exists?
  end

  # getter for feature_flag_option instances
  #
  # * *params*
  #   - +flag_name+ (String) => name of feature flag
  #
  # * *returns*
  #   - (FeatureFlagOption)
  def get_flag_option(flag_name)
    flag = FeatureFlag.find_by(name: flag_name.to_s)
    feature_flag_options.find_by(feature_flag: flag) if flag
  end

  # set the feature flag option for a given flag
  # will create new FeatureFlagOption if none is present
  #
  # * *params*
  #   - +flag_name+ (String) => name of feature flag
  #   - +flag_value+ (Boolean) => value to set for flag
  #
  # * *returns*
  #   - (FeatureFlagOption)
  #
  # * *raises*
  #   - (NameError) => if requested feature_flag does not exist
  #   - (Mongoid::Errors::Validations) => if save fails
  def set_flag_option(flag_name, flag_value)
    parent_flag = FeatureFlag.find_by(name: flag_name)
    raise NameError, "#{flag_name} is not a valid feature flag name" if parent_flag.nil?

    option = get_flag_option(flag_name) || feature_flag_options.build(feature_flag: parent_flag)
    option.update!(value: flag_value)
    option
  end

  # remove a given feature_flag_option from this instance
  #
  # * *params*
  #   - +flag_name+ (String) => name of feature flag
  #
  # * *returns*
  #   - (Boolean) => True if option was present & destroyed, false if option was not configured
  #
  # * *raises*
  #   - (NameError) => if requested feature_flag does not exist
  def remove_flag_option(flag_name)
    raise NameError, "#{flag_name} is not a valid feature flag name" unless FeatureFlag.where(name: flag_name).exists?

    option = get_flag_option(flag_name)
    if option.present?
      option.destroy
      true
    else
      false
    end
  end

  # get an array of FeatureFlagOption objects for form rendering (e.g. updating user feature flags in admin section)
  # note: when using with a Rails form builder, pass this as the second parameter to f.fields_for to render all the
  # nested forms in the parent form:
  #
  #   <%= f.fields_for :feature_flag_options, FeatureFlaggable.build_feature_flag_options(@user) do |ff_form| %>
  #     <%= render partial: 'feature_flag_options/feature_flag_option_fields', locals: { f: ff_form } %>
  #   <% end %>
  #
  # * *params*
  #   - +instance+ (Mongoid::Model) => model instance that is FeatureFlaggable
  #
  # * *returns*
  #   - (Array<FeatureFlagOption) => array of FeatureFlagOptions for all FeatureFlags (building new where necessary)
  def self.build_feature_flag_options(instance)
    options = []
    FeatureFlag.all.order(name: :asc).each do |feature_flag|
      if instance.flag_configured?(feature_flag)
        options << instance.get_flag_option(feature_flag.name)
      else
        options << instance.feature_flag_options.build(feature_flag: feature_flag)
      end
    end
    options
  end

  # merges feature flags of the passed-in instances from left to right,
  # using the default flag has if none of the instances is present or supplies a value
  #
  # * *params*
  #   - +instances+ (Array<Mongoid::Model>) => array of FeatureFlaggable model instances, or nil
  #
  # * *returns*
  #   - (Hash) => Hash of feature flag values, merged in order passed
  def self.feature_flags_for_instances(*instances)
    flag_hash = FeatureFlag.default_flag_hash
    instances.each do |instance|
      flag_hash.merge!(instance.configured_feature_flags) if instance.present?
    end
    flag_hash.with_indifferent_access
  end

  # +DEPRECATED+
  #
  # use :remove_flag_option instead, this is only present for migration compatibility
  # updates each instance of the given model to clear the given flag
  # useful for obsoleting a given flag
  def self.remove_flag_from_model(model, flag_name)
    if model.respond_to?(:feature_flags)
      model.where(:"feature_flags.#{flag_name}".exists => true).each do |instance|
        instance.feature_flags.delete(flag_name)
        instance.save
      end
    end
  end
end
