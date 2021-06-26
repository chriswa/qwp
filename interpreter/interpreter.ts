import { Token, TokenType } from "../parser/Token"
import { SyntaxNodeVisitor, SyntaxNode, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode } from "../syntax/syntax"
import { INTERPRETER_BUILTINS } from "./builtins"
import { InterpreterRuntimeError } from "./InterpreterRuntimeError"
import { InterpreterScope } from "./InterpreterScope"
import { InterpreterValue, BooleanInterpreterValue, NumberInterpreterValue, StringInterpreterValue, NullInterpreterValue, UserFunctionInterpreterValue, BuiltInFunctionInterpreterValue, InterpreterValueType } from "./InterpreterValue"

class Return {
  constructor(
    public retval: InterpreterValue,
  ) { }
}

export class Interpreter implements SyntaxNodeVisitor<InterpreterValue> {
  private scope: InterpreterScope;
  private output = "";
  constructor() {
    this.scope = new InterpreterScope(null, INTERPRETER_BUILTINS);
  }
  appendOutput(content: string) {
    this.output += content;
  }
  getOutput(): string {
    return this.output;
  }
  interpret(node: SyntaxNode): InterpreterRuntimeError | null {
    try {
      const _result = this.evaluate(node) // discard result
      return null;
    }
    catch (error) {
      if (error instanceof InterpreterRuntimeError) {
        return error;
      }
      else {
        throw error; // rethrow
      }
    }
  }

  private evaluate(node: SyntaxNode): InterpreterValue {
    return node.accept(this);
  }
  private assertTypeOfInterpreterValue(requiredInterpreterValueType: InterpreterValueType, op: Token, value: InterpreterValue) {
    if (value.valueType !== requiredInterpreterValueType) {
      throw new InterpreterRuntimeError(op, `operand must be of type ${InterpreterValueType[requiredInterpreterValueType]}`)
    }
  }
  private assertTypeOfInterpreterValues(requiredInterpreterValueType: InterpreterValueType, op: Token, left: InterpreterValue, right: InterpreterValue) {
    if (left.valueType !== requiredInterpreterValueType || right.valueType !== requiredInterpreterValueType) {
      throw new InterpreterRuntimeError(op, `operands must be of type ${InterpreterValueType[requiredInterpreterValueType]}`)
    }
  }
  private isEqual(left: InterpreterValue, right: InterpreterValue): BooleanInterpreterValue {
    if (left.valueType !== right.valueType) {
      return BooleanInterpreterValue.FALSE;
    }
    switch (left.valueType) {
      case InterpreterValueType.BOOLEAN:
        return (((left as BooleanInterpreterValue).rawInterpreterValue === (right as BooleanInterpreterValue).rawInterpreterValue) ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case InterpreterValueType.NUMBER:
        return (((left as NumberInterpreterValue).rawInterpreterValue === (right as NumberInterpreterValue).rawInterpreterValue) ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case InterpreterValueType.STRING:
        return (((left as StringInterpreterValue).rawInterpreterValue === (right as StringInterpreterValue).rawInterpreterValue) ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case InterpreterValueType.NULL:
        return BooleanInterpreterValue.TRUE;
      default:
        throw new Error(`unrecognized InterpreterValueType`);
    }
  }
  visitBinary(node: BinarySyntaxNode): InterpreterValue {
    const left = this.evaluate(node.left);
    const right = this.evaluate(node.right);
    switch (node.op.type) {
      case TokenType.OP_PLUS:
        if (left instanceof StringInterpreterValue && right instanceof StringInterpreterValue) {
          return new StringInterpreterValue((left as StringInterpreterValue).rawInterpreterValue + (right as StringInterpreterValue).rawInterpreterValue);
        }
        else if (left instanceof NumberInterpreterValue && right instanceof NumberInterpreterValue) {
          return new NumberInterpreterValue((left as NumberInterpreterValue).rawInterpreterValue + (right as NumberInterpreterValue).rawInterpreterValue);
        }
        else {
          throw new InterpreterRuntimeError(node.op, "operands must either both be numbers or both be strings")
        }
      case TokenType.OP_MINUS:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return new NumberInterpreterValue((left as NumberInterpreterValue).rawInterpreterValue - (right as NumberInterpreterValue).rawInterpreterValue);
      case TokenType.OP_MULT:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return new NumberInterpreterValue((left as NumberInterpreterValue).rawInterpreterValue * (right as NumberInterpreterValue).rawInterpreterValue);
      case TokenType.OP_DIV:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return new NumberInterpreterValue((left as NumberInterpreterValue).rawInterpreterValue * (right as NumberInterpreterValue).rawInterpreterValue);
      case TokenType.OP_LT:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return ((left as NumberInterpreterValue).rawInterpreterValue < (right as NumberInterpreterValue).rawInterpreterValue ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case TokenType.OP_LTE:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return ((left as NumberInterpreterValue).rawInterpreterValue <= (right as NumberInterpreterValue).rawInterpreterValue ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case TokenType.OP_GT:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return ((left as NumberInterpreterValue).rawInterpreterValue > (right as NumberInterpreterValue).rawInterpreterValue ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case TokenType.OP_GTE:
        this.assertTypeOfInterpreterValues(InterpreterValueType.NUMBER, node.op, left, right);
        return ((left as NumberInterpreterValue).rawInterpreterValue >= (right as NumberInterpreterValue).rawInterpreterValue ? BooleanInterpreterValue.TRUE : BooleanInterpreterValue.FALSE);
      case TokenType.OP_EQ:
        return this.isEqual(left, right);
      case TokenType.OP_NEQ:
        return this.isEqual(left, right) === BooleanInterpreterValue.TRUE ? BooleanInterpreterValue.FALSE : BooleanInterpreterValue.TRUE;
      default:
        throw new Error(`Interpreter attempted to interpret a binary expression with invalid op ${TokenType[node.op.type]}`);
    }
  }
  visitUnary(node: UnarySyntaxNode): InterpreterValue {
    const right = this.evaluate(node.right);
    switch (node.op.type) {
      case TokenType.OP_MINUS:
        this.assertTypeOfInterpreterValue(InterpreterValueType.NUMBER, node.op, right);
        return new NumberInterpreterValue(-((right as NumberInterpreterValue).rawInterpreterValue));
      case TokenType.OP_BANG:
        this.assertTypeOfInterpreterValue(InterpreterValueType.BOOLEAN, node.op, right);
        return (right as BooleanInterpreterValue).rawInterpreterValue ? BooleanInterpreterValue.FALSE : BooleanInterpreterValue.TRUE;
      default:
        throw new Error(`Interpreter attempted to interpret a unary expression with invalid op ${TokenType[node.op.type]}`);
    }
  }
  visitLiteral(node: LiteralSyntaxNode): InterpreterValue {
    return InterpreterValue.create(node.type, node.value);
  }
  visitGrouping(node: GroupingSyntaxNode): InterpreterValue {
    return this.evaluate(node.expr);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): InterpreterValue {
    this.pushScope({});
    try {
      node.statementList.forEach(statementNode => {
        const _statementResult = this.evaluate(statementNode)
        // console.log(`TEMP: statement result being discarded:`)
        // console.dir(_statementResult)
      });
    }
    finally {
      this.popScope();
    }
    return NullInterpreterValue.INSTANCE;
  }
  visitIfStatement(node: IfStatementSyntaxNode): InterpreterValue {
    if (node.cond.accept(this)) {
      node.thenBranch.accept(this);
    }
    else if (node.elseBranch !== null) {
      node.elseBranch.accept(this);
    }
    return NullInterpreterValue.INSTANCE;
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): InterpreterValue {
    while (node.cond.accept(this)) {
      node.loopBody.accept(this);
    }
    return NullInterpreterValue.INSTANCE;
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): InterpreterValue {
    let retval: InterpreterValue = NullInterpreterValue.INSTANCE;
    if (node.retvalExpr !== null) {
      retval = this.evaluate(node.retvalExpr);
    }
    throw new Return(retval);
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): InterpreterValue {
    const left = this.evaluate(node.left);
    this.assertTypeOfInterpreterValue(InterpreterValueType.BOOLEAN, node.op, left);
    const isLeftTrue = (left as BooleanInterpreterValue).rawInterpreterValue;
    const isOpOr = node.op.type === TokenType.OP_OR;
    if (isOpOr && isLeftTrue || !isOpOr && !isLeftTrue) {
      return BooleanInterpreterValue.TRUE
    }
    const right = this.evaluate(node.right);
    this.assertTypeOfInterpreterValue(InterpreterValueType.BOOLEAN, node.op, right);
    return right;
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): InterpreterValue {
    return this.scope.lookup(node.identifier);
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): InterpreterValue {
    const defaultInterpreterValue = NullInterpreterValue.INSTANCE; // TODO: this should depend on variable type! (0 for number, "" for string, etc)
    const rvalue = node.rvalue === null ? defaultInterpreterValue : this.evaluate(node.rvalue);
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
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): InterpreterValue {
    return new UserFunctionInterpreterValue(node);
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): InterpreterValue {
    const functionInterpreterValue = this.evaluate(node.callee);
    
    let argumentCount = 0;
    if (functionInterpreterValue.valueType === InterpreterValueType.USER_FUNCTION) {
      argumentCount = (functionInterpreterValue as UserFunctionInterpreterValue).functionDefinition.parameterList.length;
    }
    else if (functionInterpreterValue.valueType === InterpreterValueType.BUILTIN_FUNCTION) {
      argumentCount = (functionInterpreterValue as BuiltInFunctionInterpreterValue).argumentCount;
    }
    else {
      throw new InterpreterRuntimeError(node.referenceToken, `Cannot call expression of type ${InterpreterValueType[functionInterpreterValue.valueType]} as a function`);
    }
    
    if (argumentCount !== node.argumentList.length) {
      throw new InterpreterRuntimeError(node.referenceToken, `Cannot call function which accepts ${argumentCount} parameters with ${node.argumentList.length} arguments`);
    }

    const argumentInterpreterValueList = node.argumentList.map((syntaxNode) => {
      const argumentInterpreterValue = this.evaluate(syntaxNode);
      argumentInterpreterValue.readonly = true;
      return argumentInterpreterValue;
    });

    let retval = NullInterpreterValue.INSTANCE;

    if (functionInterpreterValue.valueType === InterpreterValueType.USER_FUNCTION) {
      const functionDefinition = (functionInterpreterValue as UserFunctionInterpreterValue).functionDefinition;
      const argumentIdentifiers = functionDefinition.parameterList;
      const interim = argumentIdentifiers.map((_, i) => [argumentIdentifiers[i].lexeme, argumentInterpreterValueList[i]]);
      const table = Object.fromEntries(argumentIdentifiers.map((_, i) => [argumentIdentifiers[i].lexeme, argumentInterpreterValueList[i]]));
      this.pushScope(table);
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
      retval = (functionInterpreterValue as BuiltInFunctionInterpreterValue).handler(this, ...argumentInterpreterValueList);
    }

    return retval;
  }
  private pushScope(table: Record<string, InterpreterValue>) {
    this.scope = new InterpreterScope(this.scope, table);
  }
  private popScope() {
    if (this.scope.parentScope === null) {
      throw new Error("Cannot pop scope: already at top!")
    }
    this.scope = this.scope.parentScope;
  }
}

