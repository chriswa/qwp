type BuiltinHandler = (stackPushCallback: (float32: number) => void, args: Array<unknown>) => void;

class Builtin {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly arity: number,
    // public readonly hasReturnValue: boolean,
    // public readonly parameterTypes: Array<?>,
    public readonly handler: BuiltinHandler,
  ) { }
}

export const builtinsByName: Map<string, Builtin> = new Map();
export const builtinsById: Map<number, Builtin> = new Map();

function registerBuiltin(id: number, name: string, arity: number, handler: BuiltinHandler) {
  if (!Number.isInteger(id) || id < 0 || id > 2 ** 16 - 1) { throw new Error(`builtin id must be uint32`) }
  const builtin = new Builtin(id, name, arity, handler);
  builtinsByName.set(name, builtin);
  builtinsById.set(id, builtin);
}

registerBuiltin(0xf000, "println", 1, (arg) => {
  console.log(arg);
});

