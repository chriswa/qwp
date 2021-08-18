export abstract class Type {
  public abstract toString(): string;
}

export class PrimitiveType extends Type {
  constructor(
    public typeName: string,
  ) {
    super();
  }
  toString() {
    return this.typeName;
  }
}

// export class ClassDefinition extends Type {
//   public baseClassDef: ClassDefinition | null = null;
//   // public methods: Map<string, ???> = new Map();
//   // public fields: Map<string, ???> = new Map();
//   constructor(
//     name: string,
//   ) {
//     super(name);
//   }
// }


export const primitiveTypes = {
  uint32: new PrimitiveType('uint32'),
  float32: new PrimitiveType('float32'),
  bool32: new PrimitiveType('bool32'),
  void: new PrimitiveType('void'),
  any: new PrimitiveType('any'),
  never: new PrimitiveType('never'),
};

export class FunctionType extends Type {
  constructor(
    public argumentTypes: Array<Type>,
    public returnType: Type,
  ) {
    super();
  }
  toString() {
    return `fn((${this.argumentTypes.map(argumentType => argumentType.toString()).join(', ')}) => ${this.returnType.toString()})`;
  }
}
