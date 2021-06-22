import { ValueType } from "../syntax/syntax"

export abstract class Value {
  public abstract get valueType(): ValueType;
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
  public get valueType() { return ValueType.BOOLEAN; }
  public constructor(
    public rawValue: boolean,
  ) {
    super();
  }
  public static TRUE: BooleanValue = new BooleanValue(true);
  public static FALSE: BooleanValue = new BooleanValue(false);
}
export class NumberValue extends Value {
  public get valueType() { return ValueType.NUMBER; }
  public constructor(
    public rawValue: number,
  ) {
    super();
  }
}
export class StringValue extends Value {
  public get valueType() { return ValueType.STRING; }
  public constructor(
    public rawValue: string,
  ) {
    super();
  }
}
export class NullValue extends Value {
  public get valueType() { return ValueType.NULL; }
  public constructor(
  ) {
    super();
  }
  public static INSTANCE: NullValue = new NullValue();
}
