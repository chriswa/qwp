import { GenericDefinition } from "./compiler/syntax/GenericDefinition"
import { Token } from "./compiler/Token"

export abstract class Type {
  public abstract toString(): string;
}

export class PrimitiveType extends Type {
  constructor(
    public name: string,
  ) {
    super();
  }
  toString() {
    return this.name;
  }
}

export class InterfaceType extends Type {
  constructor(
    public name: string,
  ) {
    super();
  }
  toString() {
    return `interface ${this.name}`;
  }
}

export class ClassType extends Type {
  public genericDefinition: GenericDefinition | null = null;
  public baseClassType: ClassType | null = null;
  public interfaceTypes: Array<InterfaceType> = [];
  public fields: Map<string, Type> = new Map();
  public methods: Map<string, FunctionType> = new Map();
  constructor(
    public referenceToken: Token,
    public name: string,
  ) {
    super();
  }
  toString() {
    return `class ${this.name}`;
  }
}


export const primitiveTypes = {
  uint32: new PrimitiveType('uint32'),
  float32: new PrimitiveType('float32'),
  bool32: new PrimitiveType('bool32'),
  void: new PrimitiveType('void'),
  any: new PrimitiveType('any'),
  never: new PrimitiveType('never'),
};

export const primitiveTypesMap = new Map(Object.entries(primitiveTypes));

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
