import { FunctionDefinitionSyntaxNode } from "../sourcecode/syntax/syntax"
import { Interpreter } from "./Interpreter"

export enum InterpreterValueType {
  BOOLEAN,
  NUMBER,
  STRING,
  NULL,
  USER_FUNCTION,
  BUILTIN_FUNCTION,
}

export interface InterpreterValueVisitor<T> {
  visitBoolean(node: BooleanInterpreterValue): T;
  visitNumber(node: NumberInterpreterValue): T;
  visitString(node: StringInterpreterValue): T;
  visitNull(node: NullInterpreterValue): T;
  visitUserFunction(node: UserFunctionInterpreterValue): T;
  visitBuiltInFunction(node: BuiltInFunctionInterpreterValue): T;
}

export abstract class InterpreterValue {
  public abstract get valueType(): InterpreterValueType;
  public readonly: boolean = false;
  public abstract accept<R>(visitor: InterpreterValueVisitor<R>): R;
  public abstract stringify(): string;
  protected constructor(
  ) { }
  public static create(valueType: InterpreterValueType, rawInterpreterValue: unknown) {
    switch (valueType) {
      case InterpreterValueType.BOOLEAN:
        return rawInterpreterValue === true ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE;
      case InterpreterValueType.NUMBER:
        return new NumberInterpreterValue(rawInterpreterValue as number);
      case InterpreterValueType.STRING:
        return new StringInterpreterValue(rawInterpreterValue as string);
      case InterpreterValueType.NULL:
        return NullInterpreterValue.INSTANCE;
      default:
        throw new Error(`Attempted to create a InterpreterValue with unknown valueType ${InterpreterValueType[valueType]}`);
    }
  }
}
export class BooleanInterpreterValue extends InterpreterValue {
  public get valueType() { return InterpreterValueType.BOOLEAN }
  accept<R>(visitor: InterpreterValueVisitor<R>) {
    return visitor.visitBoolean(this);
  }
  public constructor(
    public rawInterpreterValue: boolean,
  ) {
    super();
  }
  stringify() { return this.rawInterpreterValue ? "TRUE" : "FALSE" }
  public static TRUE: BooleanInterpreterValue = new BooleanInterpreterValue(true);
  public static FALSE: BooleanInterpreterValue = new BooleanInterpreterValue(false);
}
export class NumberInterpreterValue extends InterpreterValue {
  public get valueType() { return InterpreterValueType.NUMBER; }
  accept<R>(visitor: InterpreterValueVisitor<R>) {
    return visitor.visitNumber(this);
  }
  public constructor(
    public rawInterpreterValue: number,
  ) {
    super();
  }
  stringify() { return this.rawInterpreterValue.toString(); }
}
export class StringInterpreterValue extends InterpreterValue {
  public get valueType() { return InterpreterValueType.STRING; }
  accept<R>(visitor: InterpreterValueVisitor<R>) {
    return visitor.visitString(this);
  }
  public constructor(
    public rawInterpreterValue: string,
  ) {
    super();
  }
  stringify() { return this.rawInterpreterValue; }
}
export class NullInterpreterValue extends InterpreterValue {
  public get valueType() { return InterpreterValueType.NULL; }
  accept<R>(visitor: InterpreterValueVisitor<R>) {
    return visitor.visitNull(this);
  }
  public constructor(
  ) {
    super();
  }
  stringify() { return "NULL"; }
  public static INSTANCE: NullInterpreterValue = new NullInterpreterValue();
}
export class UserFunctionInterpreterValue extends InterpreterValue {
  public get valueType() { return InterpreterValueType.USER_FUNCTION; }
  accept<R>(visitor: InterpreterValueVisitor<R>) {
    return visitor.visitUserFunction(this);
  }
  public constructor(
    public functionDefinition: FunctionDefinitionSyntaxNode,
  ) {
    super();
  }
  stringify() { return "[FUNCTION]"; }
}
export class BuiltInFunctionInterpreterValue extends InterpreterValue {
  public get valueType() { return InterpreterValueType.BUILTIN_FUNCTION; }
  accept<R>(visitor: InterpreterValueVisitor<R>) {
    return visitor.visitBuiltInFunction(this);
  }
  public constructor(
    public argumentCount: number,
    public handler: (interpreter: Interpreter, ...args: Array<InterpreterValue>) => InterpreterValue,
  ) {
    super();
    this.readonly = true;
  }
  stringify() { return "[BUILTIN FUNCTION]"; }
}
