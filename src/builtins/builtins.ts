import { TypeWrapper, BuiltinFunctionHomonymType, Type, primitiveTypes, BuiltinFunctionOverloadType } from "../types/types"

let printCallback: (str: string) => void = console.log;

export function setBuiltinPrintCallback(f: typeof printCallback) {
  printCallback = f;
}

type BuiltinHandler = (args: Array<unknown>) => number;

export class BuiltinOverload {
  constructor(
    public readonly typeWrapper: TypeWrapper,
    public readonly handler: BuiltinHandler,
  ) { }
}

export class Builtin {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly overloads: Array<BuiltinOverload> = [],
    public readonly typeWrapper: TypeWrapper,
  ) { }
}

export const builtinsByName: Map<string, Builtin> = new Map();
export const builtinsById: Map<number, Builtin> = new Map();

function registerBuiltin(id: number, name: string, overloadDefs: Array<{ args: Array<Type>, ret: Type, handler: BuiltinHandler }>) {
  const overloads = overloadDefs.map(({ args, ret, handler }) => {
    const argumentTypeWrappers = args.map((argumentType, index) => new TypeWrapper(`builtin(${name}).arg[${index}]`, argumentType));
    const returnTypeWrapper = new TypeWrapper(`builtin(${name}).return`, ret);
    const typeWrapper = new TypeWrapper(`builtin(${name})`, new BuiltinFunctionOverloadType(argumentTypeWrappers, returnTypeWrapper));
    return new BuiltinOverload(typeWrapper, handler);
  });
  if (!Number.isInteger(id) || id < 0 || id > 2 ** 16 - 1) { throw new Error(`builtin id must be uint32`) }
  const builtinTypeWrapper = new BuiltinFunctionHomonymType(overloads.map(overload => overload.typeWrapper));
  const builtin = new Builtin(id, name, overloads, new TypeWrapper(`builtin(${name})`, builtinTypeWrapper));
  builtinsByName.set(name, builtin);
  builtinsById.set(id, builtin);
}

let incId = 0;

registerBuiltin(incId++, "printFloat32", [
  {
    args: [primitiveTypes.float32], ret: primitiveTypes.void, handler: (args) => {
      printCallback(`printFloat32: ${args}`)
      return 0; // ???
    }
  },
]);

registerBuiltin(incId++, "printUint32", [
  {
    args: [primitiveTypes.uint32], ret: primitiveTypes.void, handler: (args) => {
      printCallback(`printUint32: ${args}`)
      return 0; // ???
    }
  },
]);

registerBuiltin(incId++, "print", [
  {
    args: [primitiveTypes.uint32], ret: primitiveTypes.void, handler: (args) => {
      printCallback(`print: ${args}`)
      return 0; // ???
    }
  },
  {
    args: [primitiveTypes.float32], ret: primitiveTypes.void, handler: (args) => {
      printCallback(`print: ${args}`)
      return 0; // ???
    }
  },
]);

registerBuiltin(incId++, "+", [
  {
    args: [primitiveTypes.float32, primitiveTypes.float32], ret: primitiveTypes.float32, handler: (args: any) => {
      return args[0] + args[1];
    }
  },
  {
    args: [primitiveTypes.uint32, primitiveTypes.uint32], ret: primitiveTypes.uint32, handler: (args: any) => {
      return args[0] + args[1];
    }
  },
]);

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
