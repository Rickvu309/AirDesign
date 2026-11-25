# Component column

The column component turns rows into bars and labels. It paints ordinary layers so the editor, filmstrip and PDF use the same chart.

## Sub-features

- Automatic precision uses the rounded display values and shares one precision across the chart.
- The legend uses the series color by default. The signed variant uses the positive and negative colors and labels the signs present.

## How to get to it (user POV)

- Open a deck that contains a column component. Its bars, labels and legend appear on the slide and in the filmstrip.

## Driving it with verify-airdesign

- Run `$V journey <run> component-column` after `$V doctor <run>` passes. The journey checks the saved layers, measured legend, canvas, filmstrip and exported PDF.

## Gotchas

- A legend that cannot fit reports which items were omitted.
