import { render } from '@testing-library/react'
import { highlightText, shortenDescription, descriptionCharacterLimit } from 'components/search/results/StudySearchResult'


describe('highlightText', () => {
  const text = 'Study: Single nucleus RNA-seq of cell diversity in the adult mouse hippocampus (sNuc-Seq)'
  const expectedHighlightedText = 'Study: Single <span class=\'highlight\'>nucleus</span> RNA-seq of cell <span class=\'highlight\'>diversity</span> in the adult mouse hippocampus (sNuc-Seq)'
  const unMatchedTerms = ['tuberculosis', 'population']
  const matchedTerms = ['nUcLEus', 'and', 'diVERsity']

  it('returns unaltered text when there are no matches', () => {
    const unhighlightedText = highlightText(text, unMatchedTerms).styledText
    expect(unhighlightedText).toEqual(text)
  })
  it('returns highlighted text', () => {
    const expectedMatchIndices = matchedTerms.map(term => text.indexOf(term))
    const { styledText, matchedIndices } = highlightText(text, matchedTerms)

    // Check terms were matched in the correct place
    expect(matchedIndices).toEqual(expectedMatchIndices)
    // Check text highlighted properly
    expect(styledText).toEqual(expectedHighlightedText)
  })
})

describe('shortenDescription', () => {
  // 845 characters 133 words
  const text = 'This study presents an example analysis of an eye (retina) dataset from the Human Cell Atlas (HCA)\
 Data Coordination Platform (DCP) Project entitled "A single-cell transcriptome atlas of the adult human retina".\
 It is part of the HCA March 2020 Release (INSERT Link to the DCP page) and showcases HCA single-cell data that were\
processed with standardized DCP pipelines, further analyzed by Cumulus (LINK), and annotated using published annotations. \
In this study, you can explore the biological and technical attributes of the analyzed HCA DCP data. Additionally, you can \
view all HCA Release study pages and search genes across all projects by visiting the Single Cell Portal Release Page. Please \
note that Release data is not corrected for batch-effects, but is stratified by organ and (in some cases) developmental stage as described below. '

  // For default state where there are no keyword search inquiries
  it('shortens description for study descriptions > descriptionCharacterLimit', () => {
    const expectedText = text.slice(0, descriptionCharacterLimit)
    const keywordTerms = []
    const { container } = render(shortenDescription(text, keywordTerms))
    const actualText = container.getElementsByClassName('studyDescription')[0].textContent
    expect(actualText).toEqual(expectedText)
  })

  // Matches are within 750 character boundary
  it('show matches when matches are within 750 character boundary', () => {
    const expectedText = 'This study presents an example analysis of an eye (retina) dataset from the Human Cell Atlas (HCA) Data Coordination Platform (DCP) Project entitled "A single-cell transcriptome\
 atlas of the adult human retina". It is part of the HCA March 2020 Release (INSERT Link to the DCP page)\
 and showcases HCA single-cell data that wereprocessed with standardized DCP pipelines, further analyzed by\
 Cumulus (LINK), and annotated using published annotations. In this study, you can explore the biological and\
 technical attributes of the analyzed HCA DCP data. Additionally, you can view all HCA Release study pages and\
 search genes across all projects by visiting the Single Cell Portal Release Pag'
    const keywordTerms = ['study']
    const { container } = render(shortenDescription(text, keywordTerms))
    // Span tag for opening text should not exist
    expect(container.getElementsByClassName('openingText')).toHaveLength(0)

    // Find span with matched text
    const matchedDescription = container.getElementsByClassName('studyDescription')
    expect(matchedDescription).toHaveLength(1)
    const actualMatchedDescription = matchedDescription[0].textContent
    expect(actualMatchedDescription).toEqual(expectedText)
  })

  it('shows opening text and matches outside of 750 charcter boundary', () => {
    const expectedOpeningText ='This study presents an example analysis of an eye (retina) dataset from the Human Cell Atlas (HCA) Data Coordination Platform (DCP) Project entitled \" '
    const expectedMatchedDescription= 'hat Release data is not corrected for batch-effects, but is stratified by organ and (in some cases) developmental stage as described below. '
    const keywordTerms = ['developmental']

    const { container } = render(shortenDescription(text, keywordTerms))

    // Find span tag with openingText
    const openingTextSpan = container.getElementsByClassName('openingText')
    expect(openingTextSpan).toHaveLength(1)
    const actualopeningText = openingTextSpan[0].textContent
    expect(actualopeningText).toEqual(expectedOpeningText)


    // Find span with matched text
    const matchedDescription = container.getElementsByClassName('studyDescription')
    expect(matchedDescription).toHaveLength(1)
    const actualMatchedDescription = matchedDescription[0].textContent
    expect(actualMatchedDescription).toEqual(expectedMatchedDescription)
  })
})
