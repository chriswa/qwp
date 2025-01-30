import { TypeWrapper, BuiltinFunctionHomonymType, Type, primitiveTypes as pt, BuiltinFunctionOverloadType } from '../types/types'
import { InternalError, zipMap } from '../util'

let printCallback: (str: string) => void = console.log

export function setBuiltinPrintCallback(f: typeof printCallback): void {
  printCallback = f
}

type BuiltinHandler = (args: Array<unknown>) => unknown

export class BuiltinOverload {
  constructor(
    public readonly typeWrapper: TypeWrapper,
    public readonly handler: BuiltinHandler,
    public readonly cost: number,
  ) { }
}

export class Builtin {
  public overloads: Array<BuiltinOverload> = []
  constructor(
    public readonly id: number,
    public readonly name: string,
    // public readonly typeWrapper: TypeWrapper,
  ) { }
  getTypeWrapper(): TypeWrapper {
    return new TypeWrapper(`builtin(${this.name})`, new BuiltinFunctionHomonymType(this.overloads.map((overload) => overload.typeWrapper)))
  }
  findMatchingOverload(argumentTypes: Array<Type>): BuiltinOverload {
    if (this.overloads.length === 1) {
      return this.overloads[ 0 ]
    }
    let bestOverload: BuiltinOverload | undefined = undefined
    this.overloads.forEach((overload) => {
      const overloadType = overload.typeWrapper.getFunctionOverloadType()
      let isMatch = true
      zipMap([ overloadType.parameterTypeWrappers, argumentTypes ], (parameterTypeWrapper, argumentType) => {
        if (parameterTypeWrapper.type.isEqualTo(argumentType) === false) { // TODO: allow type coercion (e.g. super to sub class, or int to float) but score it lower!
          isMatch = false
        }
      })
      if (isMatch) {
        bestOverload = overload
      }
    })
    if (bestOverload === undefined) {
      throw new InternalError('could not find acceptable builtin overload for argument types!')
    }
    return bestOverload
  }
}

export const builtinsByName: Map<string, Builtin> = new Map()
export const builtinsById: Map<number, Builtin> = new Map()

let incId = 0
export function registerBuiltinOverload(name: string, argTypes: Array<Type>, retvalType: Type, cost: number, handler: BuiltinHandler): void {
  // find existing builtin by name or create it
  let builtin = builtinsByName.get(name)
  if (builtin === undefined) {
    const id = incId++
    if (!Number.isInteger(id) || id < 0 || id > (2 ** 16) - 1) { throw new InternalError('builtin id must be uint32') }
    builtin = new Builtin(id, name)
    builtinsByName.set(name, builtin)
    builtinsById.set(id, builtin)
  }
  // TODO: ensure that the caller doesn't add an ambiguous overload
  const overloadArgumentTypeWrappers = argTypes.map((argumentType, index) => new TypeWrapper(`builtin(${name}).arg[${index}]`, argumentType))
  const overloadReturnTypeWrapper = new TypeWrapper(`builtin(${name}).return`, retvalType)
  const overloadTypeWrapper = new TypeWrapper(`builtin(${name})`, new BuiltinFunctionOverloadType(overloadArgumentTypeWrappers, overloadReturnTypeWrapper))
  const overload = new BuiltinOverload(overloadTypeWrapper, handler, cost)
  builtin.overloads.push(overload)
}

registerBuiltinOverload('printFloat32', [ pt.float32 ], pt.void, 1, (args) => { printCallback(`printFloat32: ${args}`) })

registerBuiltinOverload('printUint32', [ pt.uint32 ], pt.void, 1, (args) => { printCallback(`printUint32: ${args}`) })

registerBuiltinOverload('print', [ pt.uint32 ], pt.void, 1, (args) => { printCallback(`print: ${args}`) })
registerBuiltinOverload('print', [ pt.float32 ], pt.void, 1, (args) => { printCallback(`print: ${args}`) })

registerBuiltinOverload('+', [ pt.float32, pt.float32 ], pt.float32, 0, (args: any) => { return (args[ 0 ] as number) + (args[ 1 ] as number) })
registerBuiltinOverload('+', [ pt.uint32, pt.uint32 ], pt.uint32, 0, (args: any) => { return (args[ 0 ] as number) + (args[ 1 ] as number) })

registerBuiltinOverload('-', [ pt.float32, pt.float32 ], pt.float32, 0, (args: any) => { return (args[ 0 ] as number) - (args[ 1 ] as number) })
registerBuiltinOverload('-', [ pt.uint32, pt.uint32 ], pt.uint32, 0, (args: any) => { return (args[ 0 ] as number) - (args[ 1 ] as number) })

registerBuiltinOverload('*', [ pt.float32, pt.float32 ], pt.float32, 0, (args: any) => { return (args[ 0 ] as number) * (args[ 1 ] as number) })
registerBuiltinOverload('*', [ pt.uint32, pt.uint32 ], pt.uint32, 0, (args: any) => { return (args[ 0 ] as number) * (args[ 1 ] as number) })

registerBuiltinOverload('/', [ pt.float32, pt.float32 ], pt.float32, 0, (args: any) => { return (args[ 0 ] as number) / (args[ 1 ] as number) })
registerBuiltinOverload('/', [ pt.uint32, pt.uint32 ], pt.uint32, 0, (args: any) => { return (args[ 0 ] as number) / (args[ 1 ] as number) })

registerBuiltinOverload('<', [ pt.float32, pt.float32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) < (args[ 1 ] as number) })
registerBuiltinOverload('<', [ pt.uint32, pt.uint32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) < (args[ 1 ] as number) })

registerBuiltinOverload('<=', [ pt.float32, pt.float32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) <= (args[ 1 ] as number) })
registerBuiltinOverload('<=', [ pt.uint32, pt.uint32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) <= (args[ 1 ] as number) })

registerBuiltinOverload('>', [ pt.float32, pt.float32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) > (args[ 1 ] as number) })
registerBuiltinOverload('>', [ pt.uint32, pt.uint32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) > (args[ 1 ] as number) })

registerBuiltinOverload('>=', [ pt.float32, pt.float32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) >= (args[ 1 ] as number) })
registerBuiltinOverload('>=', [ pt.uint32, pt.uint32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) >= (args[ 1 ] as number) })

registerBuiltinOverload('==', [ pt.float32, pt.float32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) === (args[ 1 ] as number) })
registerBuiltinOverload('==', [ pt.uint32, pt.uint32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) === (args[ 1 ] as number) })

registerBuiltinOverload('!=', [ pt.float32, pt.float32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) !== (args[ 1 ] as number) })
registerBuiltinOverload('!=', [ pt.uint32, pt.uint32 ], pt.bool32, 0, (args: any) => { return (args[ 0 ] as number) !== (args[ 1 ] as number) })

registerBuiltinOverload('0-', [ pt.float32 ], pt.float32, 0, (args: any) => { return -(args[ 0 ] as number) })
registerBuiltinOverload('0-', [ pt.uint32 ], pt.uint32, 0, (args: any) => { return -(args[ 0 ] as number) })

registerBuiltinOverload('!', [ pt.bool32 ], pt.bool32, 0, (args: any) => { return !(args[ 0 ] as boolean) })
