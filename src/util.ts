export function mapMap<T, U, V>(oldMap: Map<T, U>, transformer: (input: U) => V): Map<T, V> {
  const newMap: Map<T, V> = new Map();
  oldMap.forEach((value, key) => {
    newMap.set(key, transformer(value));
  });
  return newMap;
}
