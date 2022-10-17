class AddLegendSearchFlag < Mongoid::Migration
    def self.up
      FeatureFlag.create!(name: 'legend_search',
                                  default_value: false,
                                  description: 'enable legend search')
    end
  
    def self.down
      FeatureFlag.find_by(name: 'legend_search').destroy
    end
  end
  