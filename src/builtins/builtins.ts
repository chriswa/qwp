import { FunctionType, primitiveTypes, Type } from "../types"

let printFunction: (str: string) => void = console.log;

export function setBuiltinPrintFunction(f: typeof printFunction) {
  printFunction = f;
}

type BuiltinHandler = (args: Array<unknown>) => number;

export class Builtin {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly type: FunctionType,
    public readonly handler: BuiltinHandler,
  ) { }
}

export const builtinsByName: Map<string, Builtin> = new Map();
export const builtinsById: Map<number, Builtin> = new Map();
export const builtinsTypesByName: Map<string, Type> = new Map();

function registerBuiltin(id: number, name: string, type: FunctionType, handler: BuiltinHandler) {
  if (!Number.isInteger(id) || id < 0 || id > 2 ** 16 - 1) { throw new Error(`builtin id must be uint32`) }
  const builtin = new Builtin(id, name, type, handler);
  builtinsByName.set(name, builtin);
  builtinsById.set(id, builtin);
  builtinsTypesByName.set(name, builtin.type);
}

registerBuiltin(0x0000, "printFloat32", new FunctionType([primitiveTypes.float32], primitiveTypes.void), (args) => {
  printFunction(`printFloat32: ${args}`)
  return 0;
});

registerBuiltin(0x0001, "printUint32", new FunctionType([primitiveTypes.uint32], primitiveTypes.void), (args) => {
  printFunction(`printUint32: ${args}`)
  return 0;
});

