class AddProgressiveLoadingFlag < Mongoid::Migration
  def self.up
    FeatureFlag.create!(name: 'progressive_loading',
                                default_value: false,
                                description: 'enable loading expression scatter plots as static image first, then interactive')
  end

  def self.down
    FeatureFlag.find_by(name: 'progressive_loading').destroy
  end
end
