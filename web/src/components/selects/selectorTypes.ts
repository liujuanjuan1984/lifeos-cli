export const SelectorSpecialValue = {
  None: "__none__",
  All: "__all__",
  Default: "__default__",
} as const;

export type SelectorSpecialValue =
  (typeof SelectorSpecialValue)[keyof typeof SelectorSpecialValue];

export type SelectorValue = string | SelectorSpecialValue | undefined | null;

const isSelectorSpecialValue = (
  value: unknown,
): value is SelectorSpecialValue => {
  return Object.values(SelectorSpecialValue).includes(
    value as SelectorSpecialValue,
  );
};

export const asSelectorString = (value: SelectorValue): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (isSelectorSpecialValue(value)) {
    return value;
  }
  return String(value);
};
