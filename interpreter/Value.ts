import { FunctionDefinitionSyntaxNode } from "../syntax/syntax"
import { Interpreter } from "./interpreter"

export enum ValueType {
  BOOLEAN,
  NUMBER,
  STRING,
  NULL,
  USER_FUNCTION,
  BUILTIN_FUNCTION,
}

export interface ValueVisitor<T> {
  visitBoolean(node: BooleanValue): T;
  visitNumber(node: NumberValue): T;
  visitString(node: StringValue): T;
  visitNull(node: NullValue): T;
  visitUserFunction(node: UserFunctionValue): T;
  visitBuiltInFunction(node: BuiltInFunctionValue): T;
}

export abstract class Value {
  public abstract get valueType(): ValueType;
  public readonly: boolean = false;
  public abstract accept<R>(visitor: ValueVisitor<R>): R;
  public abstract stringify(): string;
  protected constructor(
  ) { }
  public static create(valueType: ValueType, rawValue: unknown) {
    switch (valueType) {
      case ValueType.BOOLEAN:
        return rawValue === true ? BooleanValue.TRUE : BooleanValue.FALSE;
      case ValueType.NUMBER:
        return new NumberValue(rawValue as number);
      case ValueType.STRING:
        return new StringValue(rawValue as string);
      case ValueType.NULL:
        return NullValue.INSTANCE;
      default:
        throw new Error(`Attempted to create a Value with unknown valueType ${ValueType[valueType]}`);
    }
  }
}
export class BooleanValue extends Value {
  public get valueType() { return ValueType.BOOLEAN }
  accept<R>(visitor: ValueVisitor<R>) {
    return visitor.visitBoolean(this);
  }
  public constructor(
    public rawValue: boolean,
  ) {
    super();
  }
  stringify() { return this.rawValue ? "TRUE" : "FALSE" }
  public static TRUE: BooleanValue = new BooleanValue(true);
  public static FALSE: BooleanValue = new BooleanValue(false);
}
export class NumberValue extends Value {
  public get valueType() { return ValueType.NUMBER; }
  accept<R>(visitor: ValueVisitor<R>) {
    return visitor.visitNumber(this);
  }
  public constructor(
    public rawValue: number,
  ) {
    super();
  }
  stringify() { return this.rawValue.toString(); }
}
export class StringValue extends Value {
  public get valueType() { return ValueType.STRING; }
  accept<R>(visitor: ValueVisitor<R>) {
    return visitor.visitString(this);
  }
  public constructor(
    public rawValue: string,
  ) {
    super();
  }
  stringify() { return this.rawValue; }
}
export class NullValue extends Value {
  public get valueType() { return ValueType.NULL; }
  accept<R>(visitor: ValueVisitor<R>) {
    return visitor.visitNull(this);
  }
  public constructor(
  ) {
    super();
  }
  stringify() { return "NULL"; }
  public static INSTANCE: NullValue = new NullValue();
}
export class UserFunctionValue extends Value {
  public get valueType() { return ValueType.USER_FUNCTION; }
  accept<R>(visitor: ValueVisitor<R>) {
    return visitor.visitUserFunction(this);
  }
  public constructor(
    public functionDefinition: FunctionDefinitionSyntaxNode,
  ) {
    super();
  }
  stringify() { return "[FUNCTION]"; }
}
export class BuiltInFunctionValue extends Value {
  public get valueType() { return ValueType.BUILTIN_FUNCTION; }
  accept<R>(visitor: ValueVisitor<R>) {
    return visitor.visitBuiltInFunction(this);
  }
  public constructor(
    public argumentCount: number,
    public handler: (interpreter: Interpreter, ...args: Array<Value>) => Value,
  ) {
    super();
    this.readonly = true;
  }
  stringify() { return "[BUILTIN FUNCTION]"; }
}
