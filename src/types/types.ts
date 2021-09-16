import { ResolverScope } from "../compiler/resolver/ResolverScope"
import { GenericDefinition } from "../compiler/syntax/GenericDefinition"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { TypeAnnotation } from "../compiler/syntax/TypeAnnotation"
import { Token } from "../compiler/Token"
import { throwExpr } from "../util"

export enum ReadOnlyStatus {
  ReadOnly,
  Mutable,
};

export class TypeWrapper {
  constructor(
    public referenceNode: SyntaxNode | string,
    public type: Type,
  ) {
  }
  public toString() {
    // return `[${ this.referenceNode instanceof SyntaxNode ? this.referenceNode.kind() : this.referenceNode }]${ this.type.toString() }`;
    return this.type.toString();
  }
  public isEqualTo(other: TypeWrapper) {
    return this.type.isEqualTo(other.type);
  }
  public getFunctionType() {
    return (this.type instanceof FunctionType || this.type instanceof BuiltinFunctionType) ? this.type as IFunctionType : throwExpr(new Error(`not an IFunctionType wrapper!`));
  }
  public getFunctionOverloadType() {
    return (this.type instanceof FunctionOverloadType || this.type instanceof BuiltinFunctionOverloadType) ? this.type as IFunctionOverloadType : throwExpr(new Error(`not an IFunctionOverloadType wrapper!`));
  }
  public getClassType() {
    return this.type instanceof ClassType ? this.type as ClassType : throwExpr(new Error(`not a FunctionType wrapper!`));
  }
}

export abstract class Type {
  public abstract toString(): string;
  public isEqualTo(other: Type) {
    return this === other;
  }
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
    public resolverScope: ResolverScope,
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
    fields: Map<string, TypeWrapper>,
  ) {
    let byteOffsetCursor = 0;
    fields.forEach((fieldTypeWrapper, fieldName) => {
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
    public resolverScope: ResolverScope,
    public referenceToken: Token,
    public name: string,
    public genericDefinition: GenericDefinition | null,
    public baseClassType: TypeWrapper | null,
    public interfaceTypes: Array<TypeWrapper>,
    public fields: Map<string, TypeWrapper>,
    public methods: Map<string, TypeWrapper>,
  ) {
    super();
    this.fieldRepresentation = new ClassFieldBinaryRepresentation(this.fields);
  }
  toString() {
    return `class(${this.name})`;
  }
  getFieldTypeWrapper(propertyName: string) {
    return this.fields.get(propertyName) ?? throwExpr(new Error(`could not find field on class type`));
  }
  getPropertyTypeWrapper(propertyName: string) {
    return this.fields.get(propertyName) ?? this.methods.get(propertyName) ?? throwExpr(new Error(`could not find property on class type`));
  }
}

export const primitiveTypes = {
  uint32: new PrimitiveType('uint32'),
  float32: new PrimitiveType('float32'),
  bool32: new PrimitiveType('bool32'),
  func: new PrimitiveType('func'),
  void: new PrimitiveType('void'),
  never: new PrimitiveType('never'),
  duck: new PrimitiveType('duck'),
};

export const untypedType = new PrimitiveType('untyped');

export const primitiveTypesMap = new Map(Object.entries(primitiveTypes));

export interface IFunctionOverloadType {
  parameterTypeWrappers: Array<TypeWrapper>;
  returnTypeWrapper: TypeWrapper;
}

export interface IFunctionType {
  overloadTypeWrappers: Array<TypeWrapper>;
}

export class FunctionOverloadType extends Type implements IFunctionOverloadType {
  constructor(
    public resolverScope: ResolverScope,
    public parameterTypeWrappers: Array<TypeWrapper>,
    public returnTypeWrapper: TypeWrapper,
  ) {
    super();
  }
  toString() {
    return `fnoverload((${this.parameterTypeWrappers.map(parameterTypeWrapper => parameterTypeWrapper.toString()).join(', ')}) => ${this.returnTypeWrapper.toString()})`;
  }
}

export class FunctionType extends Type implements IFunctionType {
  constructor(
    public overloadTypeWrappers: Array<TypeWrapper>,
  ) {
    super();
  }
  toString() {
    return `fn(${this.overloadTypeWrappers.map(o => o.type.toString()).join('; ')})`;
  }
}

export class BuiltinFunctionOverloadType extends Type implements IFunctionOverloadType {
  constructor(
    public parameterTypeWrappers: Array<TypeWrapper>,
    public returnTypeWrapper: TypeWrapper,
  ) {
    super();
  }
  toString() {
    return `builtinfnoverload((${this.parameterTypeWrappers.map(parameterTypeWrapper => parameterTypeWrapper.toString()).join(', ')}) => ${this.returnTypeWrapper.toString()})`;
  }
}

export class BuiltinFunctionType extends Type implements IFunctionType {
  constructor(
    public overloadTypeWrappers: Array<TypeWrapper>,
  ) {
    super();
  }
  toString() {
    return `builtinfn(${this.overloadTypeWrappers.map(o => o.type.toString()).join('; ')})`;
  }
}

export class UnresolvedAnnotatedType extends Type {
  constructor(
    public resolverScope: ResolverScope,
    public typeAnnotation: TypeAnnotation,
  ) {
    super();
  }
  toString() {
    return `unresolved(${this.typeAnnotation?.toString()})`;
  }
}

export class SyntheticType extends Type {
  constructor(
  ) {
    super();
  }
  toString() {
    return `synthetic()`;
  }
}

export class UnresolvedCoercionType extends Type {
  constructor(
    public typeWrappers: Array<TypeWrapper>,
  ) {
    super();
    if (this.typeWrappers.length < 1) {
      throw new Error(`CoercedPeerType is intended to work with 1+ peer types`);
    }
  }
  toString() {
    return `coerced(${this.typeWrappers.map(tw => tw.toString()).join(', ')})`;
  }
}
