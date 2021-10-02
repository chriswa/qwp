import { TypeWrapper, BuiltinFunctionHomonymType, Type, primitiveTypes, BuiltinFunctionOverloadType } from "../types/types"
import { InternalError, zipMap } from "../util"

let printCallback: (str: string) => void = console.log;

export function setBuiltinPrintCallback(f: typeof printCallback) {
  printCallback = f;
}

type BuiltinHandler = (args: Array<unknown>) => unknown;

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
    return new TypeWrapper(`builtin(${this.name})`, new BuiltinFunctionHomonymType(this.overloads.map(overload => overload.typeWrapper)))
  }
  findMatchingOverload(argumentTypes: Array<Type>): BuiltinOverload {
    if (this.overloads.length === 1) {
      return this.overloads[0]
    }
    let bestOverload: BuiltinOverload | undefined
    this.overloads.forEach((overload) => {
      const overloadType = overload.typeWrapper.getFunctionOverloadType()
      let isMatch = true
      zipMap([overloadType.parameterTypeWrappers, argumentTypes], (parameterTypeWrapper, argumentType) => {
        if (parameterTypeWrapper.type.isEqualTo(argumentType) === false) { // TODO: allow type coercion (e.g. super to sub class, or int to float) but score it lower!
          isMatch = false
        }
      })
      if (isMatch) {
        bestOverload = overload
      }
    })
    if (bestOverload === undefined) {
      throw new InternalError(`could not find acceptable builtin overload for argument types!`)
    }
    return bestOverload
  }
}

export const builtinsByName: Map<string, Builtin> = new Map()
export const builtinsById: Map<number, Builtin> = new Map()

let incId = 0
export function registerBuiltinOverload(name: string, argTypes: Array<Type>, retvalType: Type, cost: number, handler: BuiltinHandler) {
  // find existing builtin by name or create it
  let builtin = builtinsByName.get(name)
  if (builtin === undefined) {
    const id = incId++
    if (!Number.isInteger(id) || id < 0 || id > 2 ** 16 - 1) { throw new InternalError(`builtin id must be uint32`) }
    builtin = new Builtin(id, name)
    builtinsByName.set(name, builtin);
    builtinsById.set(id, builtin);
  }
  // TODO: ensure that the caller doesn't add an ambiguous overload
  const overloadArgumentTypeWrappers = argTypes.map((argumentType, index) => new TypeWrapper(`builtin(${name}).arg[${index}]`, argumentType))
  const overloadReturnTypeWrapper = new TypeWrapper(`builtin(${name}).return`, retvalType)
  const overloadTypeWrapper = new TypeWrapper(`builtin(${name})`, new BuiltinFunctionOverloadType(overloadArgumentTypeWrappers, overloadReturnTypeWrapper))
  const overload = new BuiltinOverload(overloadTypeWrapper, handler, cost)
  builtin.overloads.push(overload)
}

registerBuiltinOverload("printFloat32", [primitiveTypes.float32], primitiveTypes.void, 1, (args) => {
  printCallback(`printFloat32: ${args}`)
})

registerBuiltinOverload("printUint32", [primitiveTypes.uint32], primitiveTypes.void, 1, (args) => {
  printCallback(`printUint32: ${args}`)
})

registerBuiltinOverload("print", [primitiveTypes.uint32], primitiveTypes.void, 1, (args) => {
  printCallback(`print: ${args}`)
})
registerBuiltinOverload("print", [primitiveTypes.float32], primitiveTypes.void, 1, (args) => {
  printCallback(`print: ${args}`)
})

registerBuiltinOverload("+", [primitiveTypes.float32, primitiveTypes.float32], primitiveTypes.float32, 0, (args: any) => {
  return args[0] + args[1]
})
registerBuiltinOverload("+", [primitiveTypes.uint32, primitiveTypes.uint32], primitiveTypes.uint32, 0, (args: any) => {
  return args[0] + args[1]
})

registerBuiltinOverload("==", [primitiveTypes.float32, primitiveTypes.float32], primitiveTypes.bool32, 0, (args: any) => {
  return args[0] === args[1]
})
registerBuiltinOverload("==", [primitiveTypes.uint32, primitiveTypes.uint32], primitiveTypes.bool32, 0, (args: any) => {
  return args[0] === args[1]
})

// case TokenType.PLUS: /* OpCode.ADD */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value + right.asFloat32().value)); break;
// case TokenType.MINUS: /* OpCode.SUBTRACT */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value - right.asFloat32().value)); break;
// case TokenType.ASTERISK: /* OpCode.MULTIPLY */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value * right.asFloat32().value)); break;
// case TokenType.FORWARD_SLASH: /* OpCode.DIVIDE */ this.pushValue(new InterpreterValueFloat32(left.asFloat32().value / right.asFloat32().value)); break;
// case TokenType.LESS_THAN: /* OpCode.LT */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value < right.asFloat32().value)); break;
// case TokenType.LESS_THAN_OR_EQUAL: /* OpCode.LTE */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value <= right.asFloat32().value)); break;
// case TokenType.GREATER_THAN: /* OpCode.GT */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value > right.asFloat32().value)); break;
// case TokenType.GREATER_THAN_OR_EQUAL: /* OpCode.GTE */ this.pushValue(new InterpreterValueBoolean(left.asFloat32().value >= right.asFloat32().value)); break;
// case TokenType.DOUBLE_EQUAL: /* OpCode.EQ */ this.pushValue(new InterpreterValueBoolean(left.compareStrictEquality(right) === true)); break;
// case TokenType.BANG_EQUAL: /* OpCode.NEQ */ this.pushValue(new InterpreterValueBoolean(left.compareStrictEquality(right) === false)); break;
// 
// case TokenType.MINUS: /* OpCode.SUBTRACT */ this.pushValue(new InterpreterValueFloat32(-right.asFloat32().value)); break;
// case TokenType.BANG: /* OpCode.MULTIPLY */ this.pushValue(new InterpreterValueBoolean(!right.asBoolean().value)); break;
