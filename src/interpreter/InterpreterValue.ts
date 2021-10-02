import { Builtin } from '../builtins/builtins'
import { SyntaxNode } from '../compiler/syntax/syntax'
import { primitiveTypes, Type, TypeWrapper } from '../types/types'
import { mapMapToArray } from '../util'

export function interpreterValueFactory(typeWrapper: TypeWrapper, javascriptValue: boolean | number | null | unknown): InterpreterValue {
  if (typeWrapper.type === primitiveTypes.bool32) {
    return new InterpreterValueBoolean(javascriptValue as boolean)
  }
  else if (typeWrapper.type === primitiveTypes.float32) {
    return new InterpreterValueFloat32(javascriptValue as number)
  }
  // else if (typeWrapper.type === primitiveTypes.uint32) {
  //   return new InterpreterValueUint32(javascriptValue);
  // }
  else if (typeWrapper.type === primitiveTypes.void) {
    return new InterpreterValueVoid()
  }
  else {
    throw new Error(`runtime: cannot create InterpreterValue for TypeWrapper: ${typeWrapper.toString()}`)
  }
}

export abstract class InterpreterValue {
  constructor(
  ) {
  }
  public abstract toString(): string
  public abstract toJavascriptValue(): unknown
  compareStrictEquality(other: InterpreterValue): boolean { // overridden for subtypes
    return other === this
  }
  public getType(): Type {
    return primitiveTypes.never // ???
  }
  asFloat32(): InterpreterValueFloat32 {
    if (this instanceof InterpreterValueFloat32) {
      return this
    }
    throw new Error('runtime error: attempted to interpret value as a float32')
  }
  asBoolean(): InterpreterValueBoolean {
    if (this instanceof InterpreterValueBoolean) {
      return this
    }
    throw new Error('runtime error: attempted to interpret value as a boolean')
  }
  asClosure(): InterpreterValueClosure {
    if (this instanceof InterpreterValueClosure) {
      return this
    }
    throw new Error('runtime error: attempted to interpret value as a closure')
  }
  asObject(): InterpreterValueObject {
    if (this instanceof InterpreterValueObject) {
      return this
    }
    throw new Error('runtime error: attempted to interpret value as an object')
  }
}

export class InterpreterValueBoolean extends InterpreterValue {
  constructor(
    public value: boolean,
  ) {
    super()
  }
  compareStrictEquality(other: InterpreterValue): boolean {
    return other instanceof InterpreterValueBoolean && other.value === this.value
  }
  getType(): Type {
    return primitiveTypes.bool32
  }
  toJavascriptValue(): boolean {
    return this.value
  }
  toString(): string {
    return `Boolean(${this.value ? 'true' : 'false'})`
  }
}

export class InterpreterValueFloat32 extends InterpreterValue {
  constructor(
    public value: number,
  ) {
    super()
  }
  compareStrictEquality(other: InterpreterValue): boolean {
    return other instanceof InterpreterValueFloat32 && other.value === this.value
  }
  getType(): Type {
    return primitiveTypes.float32
  }
  toJavascriptValue(): number {
    return this.value
  }
  toString(): string {
    return `Float32(${this.value})`
  }
}

export class InterpreterValueClosure extends InterpreterValue {
  constructor(
    public node: SyntaxNode,
    public closedVars: Map<string, InterpreterValue>,
  ) {
    super()
  }
  getType(): Type {
    return primitiveTypes.func // ???
  }
  toJavascriptValue(): never {
    throw new Error('InterpreterValueClosure cannot be converted to javascript value')
  }
  toString(): string {
    return `Closure(${this.node.referenceToken.lexeme} @ ${this.node.referenceToken.charPos}, closedVars: ${mapMapToArray(this.closedVars, (v, id) => `${id} => ${v.toString()}`).join(', ')})`
  }
}

export class InterpreterValueVoid extends InterpreterValue {
  constructor(
  ) {
    super()
  }
  getType(): Type {
    return primitiveTypes.void
  }
  toJavascriptValue(): never {
    throw new Error('InterpreterValueVoid cannot be converted to javascript value')
  }
  toString(): string {
    return `Void`
  }
}

export class InterpreterValueBuiltin extends InterpreterValue {
  constructor(
    public builtin: Builtin,
  ) {
    super()
  }
  getType(): Type {
    return primitiveTypes.func // ???
  }
  toJavascriptValue(): never {
    throw new Error('InterpreterValueBuiltin cannot be converted to javascript value')
  }
  toString(): string {
    return `Builtin(${this.builtin.name})`
  }
}

export class InterpreterValueObject extends InterpreterValue {
  public fields: Map<string, InterpreterValue> = new Map()
  constructor(
    public classTypeWrapper: TypeWrapper,
  ) {
    super()
  }
  getType(): Type {
    return this.classTypeWrapper.type
  }
  toJavascriptValue(): never {
    throw new Error('InterpreterValueObject cannot be converted to javascript value')
  }
  toString(): string {
    return `Object(${this.classTypeWrapper.toString()})`
  }
  getField(propertyName: string): InterpreterValue {
    const fieldValue = this.fields.get(propertyName)
    if (fieldValue !== undefined) {
      return fieldValue
    }
    throw new Error('internal error: property not defined or not initialized')
  }
  setField(fieldName: string, newValue: InterpreterValue): void {
    if (this.classTypeWrapper.getClassType().fields.has(fieldName) === false) {
      throw new Error('internal error: field not defined')
    }
    this.fields.set(fieldName, newValue)
  }
}


