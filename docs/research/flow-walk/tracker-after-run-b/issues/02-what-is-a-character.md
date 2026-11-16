# 02: What is a character?

Type: grilling
Status: resolved

## Question

What does `tally characters` count as a character?

## Answer

A Unicode code point: not a UTF-16 unit and not a byte. `"héllo 👋"` is 7 characters. Line endings count like any other character.
