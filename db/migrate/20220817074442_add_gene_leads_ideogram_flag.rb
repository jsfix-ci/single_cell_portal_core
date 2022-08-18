class AddGeneLeadsIdeogramFlag < Mongoid::Migration
  def self.up
    FeatureFlag.create!(name: 'gene_leads_ideogram',
                                default_value: false,
                                description: 'enable gene leads ideogram for initial study gene search UI')
  end

  def self.down
    FeatureFlag.find_by(name: 'gene_leads_ideogram').destroy
  end
end
