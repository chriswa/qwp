export enum Primitive {
  U32,
  F32,
}

type BuiltinHandler = (args: Array<unknown>) => number;

export class Builtin {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly parameterPrimitives: Array<Primitive>,
    public readonly returnPrimitives: Array<Primitive>,
    // public readonly parameterTypes: Array<?>,
    // public readonly returnTypes: Array<?>,
    public readonly handler: BuiltinHandler,
  ) { }
}

export const builtinsByName: Map<string, Builtin> = new Map();
export const builtinsById: Map<number, Builtin> = new Map();

function registerBuiltin(id: number, name: string, parameterPrimitives: Array<Primitive>, returnPrimitives: Array<Primitive>, handler: BuiltinHandler) {
  if (!Number.isInteger(id) || id < 0 || id > 2 ** 16 - 1) { throw new Error(`builtin id must be uint32`) }
  const builtin = new Builtin(id, name, parameterPrimitives, returnPrimitives, handler);
  builtinsByName.set(name, builtin);
  builtinsById.set(id, builtin);
}

registerBuiltin(0x0000, "printFloat32", [Primitive.F32], [], (args) => {
  console.log(`printFloat32: ${args}`)
  return 0;
});

registerBuiltin(0x0001, "printUint32", [Primitive.U32], [], (args) => {
  console.log(`printUint32: ${args}`)
  return 0;
});

