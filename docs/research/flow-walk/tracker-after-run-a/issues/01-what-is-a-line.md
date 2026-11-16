# 01: What is a line?

Type: grilling
Status: resolved

## Question

What does `tally lines` count as a line?

## Answer

A line is a run of characters ended by `\n`, plus a last run with no `\n` if it is non-empty. An empty file has 0 lines. `"a\nb"` and `"a\nb\n"` both have 2 lines. `\r\n` counts as one line ending.
