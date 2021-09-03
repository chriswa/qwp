import { TypeWrapper, BuiltinFunctionType, Type, primitiveTypes } from "../types/types"

let printFunction: (str: string) => void = console.log;

export function setBuiltinPrintFunction(f: typeof printFunction) {
  printFunction = f;
}

type BuiltinHandler = (args: Array<unknown>) => number;

export class Builtin {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly typeWrapper: TypeWrapper,
    public readonly handler: BuiltinHandler,
  ) { }
}

export const builtinsByName: Map<string, Builtin> = new Map();
export const builtinsById: Map<number, Builtin> = new Map();
export const builtinsTypeWrappersByName: Map<string, TypeWrapper> = new Map();

function registerBuiltin(id: number, name: string, argumentTypes: Array<Type>, returnType: Type, handler: BuiltinHandler) {
  const argumentTypeWrappers = argumentTypes.map((argumentType, index) => new TypeWrapper(`builtin(${name}).arg[${index}]`, argumentType));
  const returnTypeWrapper = new TypeWrapper(`builtin(${name}).return`, returnType);
  const typeWrapper = new TypeWrapper(`builtin(${name})`, new BuiltinFunctionType(argumentTypeWrappers, returnTypeWrapper));
  if (!Number.isInteger(id) || id < 0 || id > 2 ** 16 - 1) { throw new Error(`builtin id must be uint32`) }
  const builtin = new Builtin(id, name, typeWrapper, handler);
  builtinsByName.set(name, builtin);
  builtinsById.set(id, builtin);
  builtinsTypeWrappersByName.set(name, builtin.typeWrapper);
}

let incId = 0;

registerBuiltin(incId++, "printFloat32", [primitiveTypes.float32], primitiveTypes.void, (args) => {
  printFunction(`printFloat32: ${args}`)
  return 0;
});

registerBuiltin(incId++, "printUint32", [primitiveTypes.uint32], primitiveTypes.void, (args) => {
  printFunction(`printUint32: ${args}`)
  return 0;
});

registerBuiltin(incId++, "+", [primitiveTypes.float32, primitiveTypes.float32], primitiveTypes.float32, (args: any) => {
  return args[0] + args[1]
});

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
