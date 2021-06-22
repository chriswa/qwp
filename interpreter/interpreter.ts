import { Token, TokenType } from "../parser/Token"
import { SyntaxNodeVisitor, SyntaxNode, ValueType, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode } from "../syntax/syntax"
import { Value, BooleanValue, NumberValue, StringValue, NullValue } from "./Value"

class RuntimeError extends Error {
  public constructor(
    public token: Token,
    message: string,
  ) {
    super(message);
  }
}

export class Interpreter implements SyntaxNodeVisitor<any> {
  evaluate(node: SyntaxNode): Value {
    try {
      return node.accept(this);
    }
    catch (error) {
      if (error instanceof RuntimeError) {
        console.log(`Interpreter.evaluate failed:`);
        console.log(error);
        return NullValue.INSTANCE;
      }
      else {
        throw error
      }
    }
  }
  assertTypeOfOperand(requiredValueType: ValueType, op: Token, right: Value) {
    if (right.valueType !== requiredValueType) {
      throw new RuntimeError(op, `operand must be of type ${ValueType[requiredValueType]}`)
    }
  }
  assertTypeOfOperands(requiredValueType: ValueType, op: Token, left: Value, right: Value) {
    if (left.valueType !== requiredValueType || right.valueType !== requiredValueType) {
      throw new RuntimeError(op, `operands must be of type ${ValueType[requiredValueType]}`)
    }
  }
  isEqual(left: Value, right: Value): BooleanValue {
    if (left.valueType !== right.valueType) {
      return BooleanValue.FALSE;
    }
    switch (left.valueType) {
      case ValueType.BOOLEAN:
        return (((left as BooleanValue).rawValue === (right as BooleanValue).rawValue) ? BooleanValue.TRUE : BooleanValue.FALSE);
      case ValueType.NUMBER:
        return (((left as NumberValue).rawValue === (right as NumberValue).rawValue) ? BooleanValue.TRUE : BooleanValue.FALSE);
      case ValueType.STRING:
        return (((left as StringValue).rawValue === (right as StringValue).rawValue) ? BooleanValue.TRUE : BooleanValue.FALSE);
      case ValueType.NULL:
        return BooleanValue.TRUE;
      default:
        throw new Error(`unrecognized ValueType`);
    }
  }
  visitBinary(node: BinarySyntaxNode): Value {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);
    switch (node.op.type) {
      case TokenType.OP_PLUS:
        if (left instanceof StringValue && right instanceof StringValue) {
          return new StringValue((left as StringValue).rawValue + (right as StringValue).rawValue);
        }
        else if (left instanceof NumberValue && right instanceof NumberValue) {
          return new NumberValue((left as NumberValue).rawValue + (right as NumberValue).rawValue);
        }
        else {
          throw new RuntimeError(node.op, "operands must either both be numbers or both be strings")
        }
      case TokenType.OP_MINUS:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return new NumberValue((left as NumberValue).rawValue - (right as NumberValue).rawValue);
      case TokenType.OP_MULT:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return new NumberValue((left as NumberValue).rawValue * (right as NumberValue).rawValue);
      case TokenType.OP_DIV:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return new NumberValue((left as NumberValue).rawValue * (right as NumberValue).rawValue);
      case TokenType.OP_LT:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue < (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_LTE:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue <= (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_GT:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue > (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_GTE:
        this.assertTypeOfOperands(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue >= (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_EQ:
        return this.isEqual(left, right);
      case TokenType.OP_NEQ:
        return this.isEqual(left, right) === BooleanValue.TRUE ? BooleanValue.FALSE : BooleanValue.TRUE;
      default:
        throw new Error(`Interpreter attempted to interpret a binary expression with invalid op ${TokenType[node.op.type]}`);
    }
  }
  visitUnary(node: UnarySyntaxNode): Value {
    const right = this.evaluate(node.right);
    switch (node.op.type) {
      case TokenType.OP_MINUS:
        this.assertTypeOfOperand(ValueType.NUMBER, node.op, right);
        return new NumberValue(-((right as NumberValue).rawValue));
      case TokenType.OP_BANG:
        this.assertTypeOfOperand(ValueType.BOOLEAN, node.op, right);
        return (right as BooleanValue).rawValue ? BooleanValue.FALSE : BooleanValue.TRUE;
      default:
        throw new Error(`Interpreter attempted to interpret a unary expression with invalid op ${TokenType[node.op.type]}`);
    }
  }
  visitLiteral(node: LiteralSyntaxNode): Value {
    return Value.create(node.type, node.value);
  }
  visitGrouping(node: GroupingSyntaxNode): Value {
    return this.evaluate(node.expr);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): Value {
    node.statements.forEach(statementNode => {
      const _statementResult = this.evaluate(statementNode);
      console.log(`TEMP: statement result being discarded:`);
      console.dir(_statementResult);
    });
    return NullValue.INSTANCE;
  }
}
