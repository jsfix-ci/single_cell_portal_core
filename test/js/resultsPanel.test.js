import React from 'react'

import StudySearchResult from 'components/search/results/StudySearchResult'
import ResultsPanel from 'components/search/results/ResultsPanel'
import { render } from '@testing-library/react'
React.useLayoutEffect = React.useEffect

describe('<StudyResultsContainer/> rendering>', () => {
  it('should render error panel', () => {
    const { container } = render(
      <ResultsPanel studySearchState={{ isError: true }}/>
    )
    expect(container.getElementsByClassName('error-panel')).toHaveLength(1)
    expect(container.getElementsByClassName('loading-panel')).toHaveLength(0)
    expect(container.getElementsByClassName('results-header')).toHaveLength(0)
  })
  it('should render loading-panel', () => {
    const { container } = render(
      <ResultsPanel studySearchState={{ isError: false, isLoaded: false }}/>
    )
    expect(container.getElementsByClassName('loading-panel')).toHaveLength(1)
    expect(container.getElementsByClassName('error-panel')).toHaveLength(0)
    expect(container.getElementsByClassName('results-header')).toHaveLength(0)
  })
  it('should render 1 <StudyResults/>', () => {
    const studySearchState = {
      isError: false,
      isLoaded: true,
      results: {
        studies: [
          'SCP1', 'SCP2'
        ],
        facets: {}
      }
    }
    const { container } = render(
      <ResultsPanel studySearchState={studySearchState} studyComponent={StudySearchResult} />
    )
    expect(container.getElementsByClassName('loading-panel')).toHaveLength(0)
    expect(container.getElementsByClassName('error-panel')).toHaveLength(0)
    expect(container.getElementsByClassName('results-header')).toHaveLength(1)
  })
})
