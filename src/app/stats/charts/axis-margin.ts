/**
 * How wide a y-axis label is, estimated from its characters, in pixels. Digits are about 0.6 of the
 * font size wide, a thousands separator or decimal point about 0.3, a minus sign about 0.4 - close
 * enough to size a margin without measuring real text in the DOM (which a test environment can't).
 */
export function estimateLabelWidth(label: string, fontSize: number): number {
  let em = 0;
  for (const character of label) {
    if (/[0-9]/.test(character)) em += 0.6;
    else if (character === '-' || character === '\u2212') em += 0.4;
    else em += 0.3;
  }
  return em * fontSize;
}

/**
 * The chart's left margin: never less than `minimum`, otherwise just wide enough for the widest label
 * plus the axis tick and a little breathing room. Grows with the data, so a chart topping out at 9,000
 * keeps a slim margin and one reaching millions gets the extra space it needs.
 */
export function leftMarginForLabels(labels: string[], fontSize: number, minimum: number): number {
  const widest = Math.max(0, ...labels.map((label) => estimateLabelWidth(label, fontSize)));
  const axisTickAndGap = 6 + 8;
  return Math.max(minimum, Math.ceil(widest + axisTickAndGap));
}
