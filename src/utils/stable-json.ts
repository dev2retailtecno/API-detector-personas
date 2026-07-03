export function stableJsonStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;

    return Object.keys(objectValue)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        accumulator[key] = sortValue(objectValue[key]);
        return accumulator;
      }, {});
  }

  return value;
}
