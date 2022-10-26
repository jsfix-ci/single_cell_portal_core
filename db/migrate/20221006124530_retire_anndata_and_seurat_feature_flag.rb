  class RetireAnndataAndSeuratFeatureFlag < Mongoid::Migration
    def self.up
      FeatureFlag.retire_feature_flag('upload_seurat_and_anndata')
    end
  
    def self.down
      FeatureFlag.create!(name: 'upload_seurat_and_anndata',
                          default_value: false,
                          description: 'allow AnnData and seurat file uploads in the upload wizard')
    end
  end
  