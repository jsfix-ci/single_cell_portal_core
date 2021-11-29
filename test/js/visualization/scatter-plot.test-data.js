/** @fileoverview Mock responses for scatter plot tests */

export const BASIC_PLOT_DATA = {
  axes: {
    aspects: null,
    titles: {
      magnitude: 'Expression',
      x: 'X',
      y: 'Y',
      z: 'Z'
    }
  },
  scatter: {
    annotParams: {
      name: 'Category',
      type: 'group',
      scope: 'cluster'
    },
    genes: ['foo']
  },
  isAnnotatedScatter: false,
  isCorrelatedScatter: false,
  scatterColor: '',
  dataScatterColor: undefined,
  pointSize: 3,
  pointAlpha: 1,
  is3d: false,
  annotType: 'group',
  annotName: 'biosample_id',
  data: {
    x: [1, 2, 3, 4, 5, 6, 7, 8],
    y: [1, 2, 3, 4, 5, 6, 7, 8],
    cells: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    annotations: ['s1', 's1', 's1', 's1', 's2', 's2', 's1', 's2']
  }
}

/**
 * To reproduce, load synthetic study "Mouse colon cells with Salmonella", then
 * - Go to Study page
 * - In "Clustering" menu, select "cluster_many_long_odd_labels.tsv"
 */

export const MANY_LABELS_MOCKS = {
  EXPLORE_RESPONSE: {
    cluster: {
      numPoints: 130,
      isSubsampled: false
    },
    taxonNames: ['Mus musculus'],
    inferCNVIdeogramFiles: null,
    bamBundleList: [],
    uniqueGenes: [
      'Adcy5',
      'Agpat1',
      'Agpat2',
      'Agpat3',
      'Agtr1',
      'Aifm1',
      'Apex1',
      'Apoc3',
      'Apoe'
    ],
    geneLists: [],
    annotationList: {
      default_cluster: 'cluster.tsv',
      default_annotation: {
        name: 'Category',
        type: 'group',
        scope: 'cluster',
        values: [
          'A', 'B', 'C'
        ],
        identifier: 'Category--group--cluster'
      },
      annotations: [
        {
          name: 'biosample_id',
          type: 'group',
          values: [
            'AH_D06_02',
            'AH_D06_01',
            'AH_D05_03',
            'AH_D05_02',
            'AH_D05_01',
            'AH_D04_03',
            'AH_D04_02',
            'AH_D04_01',
            'AH_D03_01',
            'AH_D02_02',
            'AH_D02_01',
            'AH_D01_02',
            'AH_D01_01'
          ],
          scope: 'study'
        }, {
          name: 'disease__ontology_label',
          type: 'group',
          values: [
            'salmonella infections, animal', 'helminthiasis, animal'
          ],
          scope: 'study'
        }, {
          name: 'donor_id',
          type: 'group',
          values: [
            'AH_D06',
            'AH_D05',
            'AH_D04',
            'AH_D03',
            'AH_D02',
            'AH_D01'
          ],
          scope: 'study'
        }, {
          name: 'organism_age',
          type: 'numeric',
          values: [],
          scope: 'study'
        }, {
          name: 'Category',
          type: 'group',
          values: [
            'A.Rather.Long.Label.With.Several.Periods',
            'A',
            'An_underscored_label',
            'B label with space and number 4',
            'B',
            'C 1',
            'C 2',
            'C 3',
            'C 4',
            'C 5',
            'C 6',
            'C 7',
            'C 8',
            'C 9',
            'C 10',
            'C 11',
            'C 12',
            'C 13',
            'C 14',
            'C 15',
            'C 16',
            'C 17',
            'C 18',
            'C 19',
            'C 20',
            'C 21',
            'C 22',
            'C 23',
            'C 24'
          ],
          scope: 'cluster',
          cluster_name: 'cluster_many_long_odd_labels.tsv'
        }, {
          name: 'Intensity',
          type: 'numeric',
          values: [],
          scope: 'cluster',
          cluster_name: 'cluster_many_long_odd_labels.tsv'
        }, {
          name: 'Category',
          type: 'group',
          values: [
            'A', 'B', 'C'
          ],
          scope: 'cluster',
          cluster_name: 'cluster.tsv'
        }, {
          name: 'Intensity',
          type: 'numeric',
          values: [],
          scope: 'cluster',
          cluster_name: 'cluster.tsv'
        }, {
          name: 'biosample_type',
          type: 'group',
          values: ['PrimaryBioSample'],
          scope: 'invalid'
        }, {
          name: 'disease',
          type: 'group',
          values: [
            'MONDO_0024982', 'MONDO_0025082'
          ],
          scope: 'invalid'
        }, {
          name: 'organ',
          type: 'group',
          values: ['UBERON_0001155'],
          scope: 'invalid'
        }, {
          name: 'organ__ontology_label',
          type: 'group',
          values: ['colon'],
          scope: 'invalid'
        }, {
          name: 'library_preparation_protocol',
          type: 'group',
          values: ['EFO_0008722'],
          scope: 'invalid'
        }, {
          name: 'library_preparation_protocol__ontology_label',
          type: 'group',
          values: ['Drop-seq'],
          scope: 'invalid'
        }, {
          name: 'species',
          type: 'group',
          values: ['NCBITaxon_10090'],
          scope: 'invalid'
        }, {
          name: 'species__ontology_label',
          type: 'group',
          values: ['Mus musculus'],
          scope: 'invalid'
        }, {
          name: 'sex',
          type: 'group',
          values: ['male'],
          scope: 'invalid'
        }, {
          name: 'is_living',
          type: 'group',
          values: ['no'],
          scope: 'invalid'
        }, {
          name: 'organism_age__unit',
          type: 'group',
          values: ['UO_0000033'],
          scope: 'invalid'
        }, {
          name: 'organism_age__unit_label',
          type: 'group',
          values: ['day'],
          scope: 'invalid'
        }, {
          name: 'preservation_method',
          type: 'group',
          values: ['Fresh'],
          scope: 'invalid'
        }
      ],
      clusters: [
        'cluster_many_long_odd_labels.tsv', 'cluster.tsv'
      ],
      subsample_thresholds: {
        'cluster_many_long_odd_labels.tsv': [],
        'cluster.tsv': []
      }
    },
    clusterGroupNames: [
      'cluster_many_long_odd_labels.tsv', 'cluster.tsv'
    ],
    spatialGroups: [],
    imageFiles: [],
    clusterPointAlpha: 1,
    colorProfile: null,
    bucketId: 'fc-968ec9be-fdba-49a1-ba2e-af49281c4a1d'
  },
  CLUSTER_RESPONSE: {
    data: {
      annotations: [
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A.Rather.Long.Label.With.Several.Periods',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'An_underscored_label',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'A',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B label with space and number 4',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'B',
        'C 1',
        'C 2',
        'C 3',
        'C 4',
        'C 5',
        'C 6',
        'C 7',
        'C 8',
        'C 9',
        'C 10',
        'C 11',
        'C 12',
        'C 13',
        'C 14',
        'C 15',
        'C 16',
        'C 17',
        'C 18',
        'C 19',
        'C 20',
        'C 21',
        'C 22',
        'C 23',
        'C 24'
      ],
      cells: [
        'AH_1',
        'AH_2',
        'AH_3',
        'AH_4',
        'AH_5',
        'AH_6',
        'AH_7',
        'AH_8',
        'AH_9',
        'AH_10',
        'AH_11',
        'AH_12',
        'AH_13',
        'AH_14',
        'AH_15',
        'AH_16',
        'AH_17',
        'AH_18',
        'AH_19',
        'AH_20',
        'AH_21',
        'AH_22',
        'AH_23',
        'AH_24',
        'AH_25',
        'AH_26',
        'AH_27',
        'AH_28',
        'AH_29',
        'AH_30',
        'AH_31',
        'AH_32',
        'AH_33',
        'AH_34',
        'AH_35',
        'AH_36',
        'AH_37',
        'AH_38',
        'AH_39',
        'AH_40',
        'AH_41',
        'AH_42',
        'AH_43',
        'AH_44',
        'AH_45',
        'AH_46',
        'AH_47',
        'AH_48',
        'AH_49',
        'AH_50',
        'AH_51',
        'AH_52',
        'AH_53',
        'AH_54',
        'AH_55',
        'AH_56',
        'AH_57',
        'AH_58',
        'AH_59',
        'AH_60',
        'AH_61',
        'AH_62',
        'AH_63',
        'AH_64',
        'AH_65',
        'AH_66',
        'AH_67',
        'AH_68',
        'AH_69',
        'AH_70',
        'AH_71',
        'AH_72',
        'AH_73',
        'AH_74',
        'AH_75',
        'AH_76',
        'AH_77',
        'AH_78',
        'AH_79',
        'AH_80',
        'AH_81',
        'AH_82',
        'AH_83',
        'AH_84',
        'AH_85',
        'AH_86',
        'AH_87',
        'AH_88',
        'AH_89',
        'AH_90',
        'AH_91',
        'AH_92',
        'AH_93',
        'AH_94',
        'AH_95',
        'AH_96',
        'AH_97',
        'AH_98',
        'AH_99',
        'AH_100',
        'AH_101',
        'AH_102',
        'AH_103',
        'AH_104',
        'AH_105',
        'AH_106',
        'AH_107',
        'AH_108',
        'AH_109',
        'AH_110',
        'AH_111',
        'AH_112',
        'AH_113',
        'AH_114',
        'AH_115',
        'AH_116',
        'AH_117',
        'AH_118',
        'AH_119',
        'AH_120',
        'AH_121',
        'AH_122',
        'AH_123',
        'AH_124',
        'AH_125',
        'AH_126',
        'AH_127',
        'AH_128',
        'AH_129',
        'AH_130'
      ],
      x: [
        7.532,
        58.618,
        126.838,
        136.026,
        118.293,
        29.611,
        43.388,
        54.187,
        39.056,
        171.904,
        119.743,
        51.05,
        19.417,
        64.197,
        95.65,
        61.715,
        168.151,
        149.186,
        33.923,
        13.044,
        38.869,
        63.454,
        123.787,
        1.194,
        9.148,
        171.459,
        150.186,
        94.564,
        96.141,
        162.196,
        53.379,
        94.973,
        76.466,
        160.422,
        148.516,
        156.945,
        159.056,
        106.052,
        104.646,
        19.3,
        37.896,
        95.602,
        145.572,
        122.282,
        134.138,
        144.138,
        25.695,
        70.087,
        65.649,
        126.1,
        14.752,
        48.214,
        128.555,
        72.809,
        71.106,
        127.155,
        70.828,
        67.241,
        30.275,
        76.838,
        118.631,
        52.846,
        90.616,
        66.055,
        58.705,
        105.184,
        83.843,
        9.643,
        76.23,
        126.027,
        77.003,
        95.09,
        17.117,
        38.581,
        31.461,
        99.107,
        98.368,
        89.865,
        114.558,
        70.978,
        29.128,
        10.542,
        79.754,
        83.522,
        2.263,
        79.322,
        0.282,
        62.672,
        72.705,
        11.959,
        37.308,
        99.449,
        65.998,
        98.76,
        41.259,
        97.76,
        32.33,
        45.85,
        34.684,
        17.034,
        13.224,
        85.666,
        34.862,
        51.178,
        15.43,
        52.504,
        7.108,
        87.52,
        1.272,
        34.629,
        76.736,
        19.624,
        23.949,
        2.103,
        50.971,
        64.727,
        63.606,
        38.788,
        35.661,
        56.904,
        67.918,
        37.293,
        9.29,
        47.336,
        55.263,
        58.712,
        53.351,
        3.85,
        40.862,
        32.598
      ],
      y: [
        14.826,
        7.621,
        20.305,
        31.84,
        9.934,
        24.26,
        11.737,
        0.395,
        23.397,
        20.894,
        41.277,
        6.041,
        35.175,
        21.421,
        2.673,
        1.527,
        13.087,
        11.944,
        28.586,
        39.71,
        31.233,
        47.147,
        17.005,
        13.338,
        21.314,
        5.54,
        19.753,
        52.465,
        12.492,
        17.728,
        19.875,
        26.413,
        64.628,
        25.94,
        37.572,
        37.358,
        1.388,
        34.76,
        49.432,
        43.707,
        60.389,
        59.632,
        31.416,
        33.176,
        49.877,
        24.028,
        40.264,
        18.099,
        6.893,
        5.318,
        50.262,
        55.279,
        17.6,
        46.922,
        28.662,
        29.085,
        24.536,
        52.505,
        33.571,
        43.322,
        47.896,
        15.301,
        43.975,
        22.963,
        76.504,
        75.33,
        74.758,
        30.097,
        94.55,
        25.32,
        77.231,
        59.828,
        90.486,
        87.05,
        24.64,
        59.866,
        79.437,
        75.279,
        96.581,
        77.013,
        70.528,
        8.08,
        79.339,
        38.856,
        29.778,
        109.579,
        13.952,
        70.552,
        0.461,
        81.408,
        0.418,
        113.328,
        25.241,
        7.654,
        104.952,
        13.938,
        114.687,
        45.279,
        98.867,
        106.238,
        95.816,
        21.312,
        35.507,
        111.609,
        130.995,
        6.961,
        119.645,
        51.474,
        20.969,
        52.701,
        118.892,
        76.489,
        26.911,
        70.068,
        109.28,
        146.582,
        44.643,
        6.518,
        38.424,
        7.295,
        111.238,
        10.179,
        48.673,
        154.009,
        47.378,
        104.708,
        7.687,
        15.072,
        12.32,
        29.41
      ]
    },
    pointSize: 3,
    userSpecifiedRanges: null,
    showClusterPointBorders: false,
    description: null,
    is3D: false,
    isSubsampled: false,
    isAnnotatedScatter: false,
    isCorrelatedScatter: false,
    isSpatial: false,
    numPoints: 130,
    axes: {
      titles: {
        x: 'X',
        y: 'Y',
        z: 'Z',
        magnitude: 'Expression'
      },
      aspects: null
    },
    hasCoordinateLabels: false,
    coordinateLabels: [],
    pointAlpha: 1.0,
    cluster: 'cluster_many_long_odd_labels.tsv',
    genes: [],
    annotParams: {
      name: 'Category',
      type: 'group',
      scope: 'cluster',
      values: [
        'A.Rather.Long.Label.With.Several.Periods',
        'A',
        'An_underscored_label',
        'B label with space and number 4',
        'B',
        'C 1',
        'C 2',
        'C 3',
        'C 4',
        'C 5',
        'C 6',
        'C 7',
        'C 8',
        'C 9',
        'C 10',
        'C 11',
        'C 12',
        'C 13',
        'C 14',
        'C 15',
        'C 16',
        'C 17',
        'C 18',
        'C 19',
        'C 20',
        'C 21',
        'C 22',
        'C 23',
        'C 24'
      ],
      identifier: 'Category--group--cluster'
    },
    subsample: 'all',
    consensus: null
  }
}