/** Assign 0-based indices to every row in `rows`. */
export function reindexRows(rows: { index: number }[]): void {
  rows.forEach((row, i) => {
    row.index = i;
  });
}

/** Assign 0-based indices to every choice in a row's `objects` array. */
export function reindexChoices(choices: { index: number }[]): void {
  choices.forEach((choice, i) => {
    choice.index = i;
  });
}
