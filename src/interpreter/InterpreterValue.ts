import { Builtin } from "../builtins/builtins"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { primitiveTypes, Type } from "../types"
import { mapMapToArray } from "../util"

export function interpreterValueFactory(type: Type, javascriptValue: boolean | number | null): InterpreterValue {
  if (type === primitiveTypes.bool32) {
    return new InterpreterValueBoolean(javascriptValue as boolean)
  }
  else if (type === primitiveTypes.float32) {
    return new InterpreterValueFloat32(javascriptValue as number);
  }
  // else if (type === primitiveTypes.uint32) {
  //   return new InterpreterValueUint32(javascriptValue);
  // }
  else if (type === primitiveTypes.void) {
    return new InterpreterValueVoid();
  }
  else {
    throw new Error(`runtime: cannot create InterpreterValue for Type: ${type.toString()}`);
  }
}

export enum InterpreterValueKind {
  BOOLEAN,
  FLOAT32,
  CLOSURE,
  VOID,
  BUILTIN,
}

export abstract class InterpreterValue {
  constructor(
    public readonly kind: InterpreterValueKind,
  ) {
  }
  public abstract toString(): string;
  public abstract toJavascriptValue(): unknown;
  compareStrictEquality(other: InterpreterValue): boolean { // overridden for subtypes
    return other === this;
  }
  asFloat32() {
    if (this instanceof InterpreterValueFloat32) {
      return this;
    }
    else {
      throw new Error(`runtime error: attempted to interpret value as float32`)
    }
  }
  asBoolean() {
    if (this instanceof InterpreterValueBoolean) {
      return this;
    }
    else {
      throw new Error(`runtime error: attempted to interpret value as float32`)
    }
  }
  asClosure() {
    if (this instanceof InterpreterValueClosure) {
      return this;
    }
    else {
      throw new Error(`runtime error: attempted to interpret value as closure`)
    }
  }
}

export class InterpreterValueBoolean extends InterpreterValue {
  constructor(
    public value: boolean,
  ) {
    super(InterpreterValueKind.BOOLEAN);
  }
  compareStrictEquality(other: InterpreterValue): boolean {
    return other instanceof InterpreterValueBoolean && other.value === this.value;
  }
  toJavascriptValue() {
    return this.value;
  }
  toString() {
    return `Boolean(${this.value ? 'true' : 'false'})`;
  }
}

export class InterpreterValueFloat32 extends InterpreterValue {
  constructor(
    public value: number,
  ) {
    super(InterpreterValueKind.FLOAT32);
  }
  compareStrictEquality(other: InterpreterValue): boolean {
    return other instanceof InterpreterValueFloat32 && other.value === this.value;
  }
  toJavascriptValue() {
    return this.value;
  }
  toString() {
    return `Float32(${this.value})`;
  }
}

export class InterpreterValueClosure extends InterpreterValue {
  constructor(
    public node: SyntaxNode,
    public closedVars: Map<string, InterpreterValue>,
  ) {
    super(InterpreterValueKind.CLOSURE);
  }
  toJavascriptValue() {
    throw new Error(`InterpreterValueClosure cannot be converted to javascript value`);
  }
  toString() {
    return `Closure(${this.node.referenceToken.lexeme} @ ${this.node.referenceToken.charPos}, closedVars: ${mapMapToArray(this.closedVars, (v, id) => `${id} => ${v.toString()}`).join(', ')})`;
  }
}

export class InterpreterValueVoid extends InterpreterValue {
  constructor(
  ) {
    super(InterpreterValueKind.VOID);
  }
  toJavascriptValue() {
    throw new Error(`InterpreterValueVoid cannot be converted to javascript value`);
  }
  toString() {
    return `Void`;
  }
}

export class InterpreterValueBuiltin extends InterpreterValue {
  constructor(
    public builtin: Builtin,
  ) {
    super(InterpreterValueKind.BUILTIN);
  }
  toJavascriptValue() {
    throw new Error(`InterpreterValueBuiltin cannot be converted to javascript value`);
  }
  toString() {
    return `Builtin(${this.builtin.name})`;
  }
}


