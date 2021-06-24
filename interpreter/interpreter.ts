import { Token, TokenType } from "../parser/Token"
import { SyntaxNodeVisitor, SyntaxNode, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableIdentifierSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode } from "../syntax/syntax"
import { GLOBAL_BUILTINS } from "./builtins"
import { RuntimeError } from "./RuntimeError"
import { Scope } from "./Scope"
import { Value, BooleanValue, NumberValue, StringValue, NullValue, UserFunctionValue, BuiltInFunctionValue, ValueType } from "./Value"

class Return {
  constructor(
    public retval: Value,
  ) { }
}

export class Interpreter implements SyntaxNodeVisitor<Value> {
  scope: Scope;
  output = "";
  constructor() {
    this.scope = new Scope(null, GLOBAL_BUILTINS);
  }
  getOutput(): string {
    return this.output;
  }
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
        throw error; // rethrow
      }
    }
  }
  assertTypeOfValue(requiredValueType: ValueType, op: Token, value: Value) {
    if (value.valueType !== requiredValueType) {
      throw new RuntimeError(op, `operand must be of type ${ValueType[requiredValueType]}`)
    }
  }
  assertTypeOfValues(requiredValueType: ValueType, op: Token, left: Value, right: Value) {
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
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
        return new NumberValue((left as NumberValue).rawValue - (right as NumberValue).rawValue);
      case TokenType.OP_MULT:
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
        return new NumberValue((left as NumberValue).rawValue * (right as NumberValue).rawValue);
      case TokenType.OP_DIV:
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
        return new NumberValue((left as NumberValue).rawValue * (right as NumberValue).rawValue);
      case TokenType.OP_LT:
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue < (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_LTE:
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue <= (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_GT:
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
        return ((left as NumberValue).rawValue > (right as NumberValue).rawValue ? BooleanValue.TRUE : BooleanValue.FALSE);
      case TokenType.OP_GTE:
        this.assertTypeOfValues(ValueType.NUMBER, node.op, left, right);
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
        this.assertTypeOfValue(ValueType.NUMBER, node.op, right);
        return new NumberValue(-((right as NumberValue).rawValue));
      case TokenType.OP_BANG:
        this.assertTypeOfValue(ValueType.BOOLEAN, node.op, right);
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
    this.pushScope();
    try {
      node.statements.forEach(statementNode => {
        const _statementResult = this.evaluate(statementNode)
        // console.log(`TEMP: statement result being discarded:`)
        // console.dir(_statementResult)
      });
    }
    finally {
      this.popScope();
    }
    return NullValue.INSTANCE;
  }
  visitIfStatement(node: IfStatementSyntaxNode): Value {
    if (node.cond.accept(this)) {
      node.thenBranch.accept(this);
    }
    else if (node.elseBranch !== null) {
      node.elseBranch.accept(this);
    }
    return NullValue.INSTANCE;
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): Value {
    while (node.cond.accept(this)) {
      node.loopBody.accept(this);
    }
    return NullValue.INSTANCE;
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): Value {
    let retval: Value = NullValue.INSTANCE;
    if (node.retvalExpr !== null) {
      retval = this.evaluate(node.retvalExpr);
    }
    throw new Return(retval);
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): Value {
    const left = this.evaluate(node.left);
    this.assertTypeOfValue(ValueType.BOOLEAN, node.op, left);
    const isLeftTrue = (left as BooleanValue).rawValue;
    const isOpOr = node.op.type === TokenType.OP_OR;
    if (isOpOr && isLeftTrue || !isOpOr && !isLeftTrue) {
      return BooleanValue.TRUE
    }
    const right = this.evaluate(node.right);
    this.assertTypeOfValue(ValueType.BOOLEAN, node.op, right);
    return right;
  }
  visitVariableIdentifier(node: VariableIdentifierSyntaxNode): Value {
    return this.scope.lookup(node.identifier);
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): Value {
    const defaultValue = NullValue.INSTANCE; // TODO: this should depend on variable type! (0 for number, "" for string, etc)
    const rvalue = node.rvalue === null ? defaultValue : this.evaluate(node.rvalue);
    if (node.modifier === null) {
      this.scope.assign(node.identifier, rvalue);
    }
    else {
      if (node.modifier.type === TokenType.KEYWORD_CONST) {
        rvalue.readonly = true;
      }
      this.scope.declare(node.identifier, rvalue);
    }
    return rvalue;
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): Value {
    return new UserFunctionValue(node);
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): Value {
    const functionValue = this.evaluate(node.callee);
    
    let argumentCount = 0;
    if (functionValue.valueType === ValueType.USER_FUNCTION) {
      argumentCount = (functionValue as UserFunctionValue).functionDefinition.parameterList.length;
    }
    else if (functionValue.valueType === ValueType.BUILTIN_FUNCTION) {
      argumentCount = (functionValue as BuiltInFunctionValue).argumentCount;
    }
    else {
      throw new RuntimeError(node.referenceToken, `Cannot call expression of type ${ValueType[functionValue.valueType]} as a function`);
    }
    
    if (argumentCount !== node.argumentList.length) {
      throw new RuntimeError(node.referenceToken, `Cannot call function which accepts ${argumentCount} parameters with ${node.argumentList.length} arguments`);
    }

    const argumentValueList = node.argumentList.map((syntaxNode) => {
      const argumentValue = this.evaluate(syntaxNode);
      argumentValue.readonly = true;
      return argumentValue;
    });

    let retval = NullValue.INSTANCE;

    if (functionValue.valueType === ValueType.USER_FUNCTION) {
      const functionDefinition = (functionValue as UserFunctionValue).functionDefinition;
      this.pushScope()
      for (let i = 0; i < argumentCount; i += 1) {
        this.scope.declare(functionDefinition.parameterList[i], argumentValueList[i])
      }
      try {
        this.evaluate(functionDefinition.statementBlock)
      }
      catch (error) {
        if (error instanceof Return) {
          retval = (error as Return).retval;
        }
        else {
          throw error; // rethrow
        }
      }
      this.popScope()
    }
    else {
      retval = (functionValue as BuiltInFunctionValue).handler(this, ...argumentValueList);
    }

    return retval;
  }
  pushScope() {
    this.scope = new Scope(this.scope);
  }
  popScope() {
    if (this.scope.parentScope === null) {
      throw new Error("Cannot pop scope: already at top!")
    }
    this.scope = this.scope.parentScope;
  }
}

