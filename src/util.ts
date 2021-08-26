export type AConstructorTypeOf<T> = new (...args: any[]) => T;

export function mapMap<T, U, V>(oldMap: Map<T, U>, transformer: (value: U) => V): Map<T, V> {
  const newMap: Map<T, V> = new Map();
  oldMap.forEach((value, key) => {
    newMap.set(key, transformer(value));
  });
  return newMap;
}

export function mapMapToArray<T, U, V>(oldMap: Map<T, U>, transformer: (value: U, key: T) => V): Array<V> {
  const newArray: Array<V> = [];
  oldMap.forEach((value, key) => {
    newArray.push(transformer(value, key));
  });
  return newArray;
}

export function throwExpr(error: Error): never {
  throw error;
}
