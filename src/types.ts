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

export class ClassFieldBinaryRepresentation {
  private fieldsToByteOffsets: Map<string, number> = new Map();
  private totalFieldBytes: number;
  constructor(
    fields: Map<string, Type>,
  ) {
    let byteOffsetCursor = 0;
    fields.forEach((fieldType, fieldName) => {
      this.fieldsToByteOffsets.set(fieldName, byteOffsetCursor);
      const fieldByteLength = 4; // TODO: !!!
      byteOffsetCursor += fieldByteLength;
    });
    this.totalFieldBytes = byteOffsetCursor;
  }
  public getFieldByteOffset(identifier: string): number {
    const byteOffset = this.fieldsToByteOffsets.get(identifier);
    if (byteOffset === undefined) {
      throw new Error(`undeclared field "${identifier}"`);
    }
    return byteOffset;
  }
  public getTotalFieldBytes(): number {
    return this.totalFieldBytes;
  }
}

export class ClassType extends Type {
  public fieldRepresentation: ClassFieldBinaryRepresentation;
  constructor(
    public referenceToken: Token,
    public name: string,
    public genericDefinition: GenericDefinition | null,
    public baseClassType: ClassType | null,
    public interfaceTypes: Array<InterfaceType>,
    public fields: Map<string, Type>,
    public methods: Map<string, FunctionType>,
  ) {
    super();
    this.fieldRepresentation = new ClassFieldBinaryRepresentation(this.fields);
  }
  toString() {
    return `class(${this.name})`;
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
