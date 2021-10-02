export type AConstructorTypeOf<T> = new (...args: Array<any>) => T

export function mapMap<T, U, V>(oldMap: Map<T, U>, transformer: (value: U, key: T) => V): Map<T, V> {
  const newMap: Map<T, V> = new Map()
  oldMap.forEach((value, key) => {
    newMap.set(key, transformer(value, key))
  })
  return newMap
}

export function mapMapToArray<T, U, V>(oldMap: Map<T, U>, transformer: (value: U, key: T) => V): Array<V> {
  const newArray: Array<V> = []
  oldMap.forEach((value, key) => {
    newArray.push(transformer(value, key))
  })
  return newArray
}

export function mapGetOrPut<T, U>(map: Map<T, U>, key: T, valueCallback: () => U): U {
  const existingValue = map.get(key)
  if (existingValue !== undefined) {
    return existingValue
  }
  const newValue = valueCallback()
  map.set(key, newValue)
  return newValue
}

export function throwExpr(error: Error): never {
  throw error
}

// export function zipMap2<T, U, V>(a: Array<T>, b: Array<U>, transformer: (a: T, b: U) => V): Array<V> {
//   if (a.length !== b.length) {
//     throw new InternalError(`zipMap called with arrays which have different lengths`)
//   }
//   const newArray: Array<V> = []
//   for (let i = 0; i < a.length; i += 1) {
//     newArray.push(transformer(a[i], b[i]))
//   }
//   return newArray
// }

type MapVariadicArraysToElements<T extends Array<Array<unknown>>> = { [I in keyof T]: T[I] extends Array<infer U> ? U : never }
export function zipMap<T extends Array<Array<unknown>>, U>(arrays: [...T], transformer: (...args: MapVariadicArraysToElements<T>) => U): Array<U> {
  if (arrays.length === 0) { return [] }
  const lengths = arrays.map((array) => array.length)
  if (lengths.every((length) => length === lengths[ 0 ]) === false) {
    throw new InternalError('zipMap called with arrays which have different lengths')
  }
  const iterator: MapVariadicArraysToElements<T> = [] as Array<unknown> as MapVariadicArraysToElements<T>
  const newArray: Array<U> = []
  for (let i = 0; i < lengths[ 0 ]; i += 1) {
    for (let j = 0; j < arrays.length; j += 1) {
      const v = arrays[ j ][ i ]
      iterator[ j ] = v
    }
    newArray.push(transformer(...iterator))
  }
  return newArray
}

export class InternalError extends Error {
  constructor(message: string) {
    super(message)
  }
}
