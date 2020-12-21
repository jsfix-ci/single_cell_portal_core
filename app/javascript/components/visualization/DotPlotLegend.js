import React from 'react'
import { dotPlotColorScheme } from './DotPlot'
import _uniqueId from 'lodash/uniqueId'

/** renders an svg legend for a dotplot with color and size indicators */
export default function DotPlotLegend() {
  // Sarah N. asked for a note about non-zero in the legend, but it's unclear
  // if Morpheus supports non-zero.  It might, per the Collapse properties
  //
  //    pass_expression: '>',
  //    pass_value: '0',
  //
  // used below, but Morpheus still shows dots with "0.00".  This seems like a
  // contradiction.  So keep the note code, but don't show the note in the
  // legend until we can clarify.
  //
  // const nonzeroNote = '<text x="9" y="66">(non-zero)</text>';
  const nonzeroNote = ''
  const gradientId = _uniqueId('dotPlotGrad-')
  const colorBarWidth = 100
  const numberYPos = 30
  const labelTextYPos = 52
  return (
    <svg className="dot-plot-legend-container">
      <g className="dot-plot-legend-size">
        <circle cx="20" cy="8" r="1"/>
        <circle cx="57.5" cy="8" r="3"/>
        <circle cx="90" cy="8" r="7"/>
        <circle cx="57.5" cy="8" r="3"/>

        <text x="17" y={numberYPos}>0</text>
        <text x="50" y={numberYPos}>38</text>
        <text x="83" y={numberYPos}>75</text>

        <text x="15" y={labelTextYPos}>% expressing</text>
      </g>
      <g className="dp-legend-color" transform="translate(200, 0)">
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          {
            dotPlotColorScheme.colors.map((color, i) => {
              const value = dotPlotColorScheme.values[i] * 100
              const offset = `${value}%`
              return <stop offset={offset} stopColor={color} key={i}/>
            })
          }
        </linearGradient>
        <rect fill={`url(#${gradientId})`} width={colorBarWidth} height="14" rx="10"/>
        <text x="-1" y={numberYPos}>0</text>
        <text x={colorBarWidth / 2 - 7} y={numberYPos}>0.5</text>
        <text x={colorBarWidth - 5} y={numberYPos}>1</text>
        <rect fill="#CC0088" width="3" height="10" x={colorBarWidth / 2} y={numberYPos - 20} ry="2"/>
        <text x="-22" y={labelTextYPos}>Scaled mean expression</text>
        {nonzeroNote}
      </g>
    </svg>
  )
}