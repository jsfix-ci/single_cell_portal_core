# handle converting ActiveModel attributes into a command line string
# used in PAPI jobs via PapiClient and IngestJob
module Parameterizable
  extend ActiveSupport::Concern

  # regular expression to validate GS url format
  GS_URL_REGEXP = %r{\Ags://}.freeze

  # convert attribute name into CLI-formatted option
  def self.to_cli_opt(param_name)
    "--#{param_name.to_s.gsub(/_/, '-')}"
  end

  # return array of all initialized attributes as CLI arguments, e.g. annotation_name => --annotation-name
  # will also append PARAMETER_NAME at the end as defined by including class
  def to_options_array
    options_array = []
    attributes.each do |attr_name, value|
      options_array += [Parameterizable.to_cli_opt(attr_name), "#{value}"] if value.present?
    end
    options_array << self.class::PARAMETER_NAME
    options_array
  end
end
