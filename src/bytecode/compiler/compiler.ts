import assert from "assert"
import { Token, TokenType } from "../../sourcecode/parser/Token"
import { SyntaxNodeVisitor, SyntaxNode, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode } from "../../sourcecode/syntax/syntax"
import { ByteBuffer } from "./ByteBuffer"
import { OpCode } from "../opcodes"
import { ValueType } from "../../sourcecode/syntax/ValueType"
import { ConstantsTable } from "./ConstantsTable"
import { builtinsByName } from "../../builtins/builtins"

export function compile(ast: SyntaxNode, closedVarsByFunctionNode: Map<SyntaxNode, Array<string>>) {
  const context = new CompilerContext(closedVarsByFunctionNode, new ConstantsTable());
  return new Compiler(null, context).compileModule(ast);
}

class CompilerContext {
  public constructor(
    public closedVarsByFunctionNode: Map<SyntaxNode, Array<string>>,
    public constantsTable: ConstantsTable,
  ) { }
}

class Compiler implements SyntaxNodeVisitor<void> {
  private functionScope: CompilerFunctionScope;
  private instructionBuffer: ByteBuffer = new ByteBuffer();
  private closedVars: Set<string> = new Set();
  constructor(
    parentCompiler: Compiler | null,
    private context: CompilerContext,
  ) {
    this.functionScope = new CompilerFunctionScope(parentCompiler?.functionScope ?? null);
  }
  private get closedVarsByFunctionNode() { return this.context.closedVarsByFunctionNode }
  private get constantsTable() { return this.context.constantsTable }

  public declareParametersAndClosedVars(parameterIdentifiers: Array<string>, closedVarIdentifiers: Array<string>) {
    parameterIdentifiers.forEach((identifier) => {
      this.functionScope.currentBlockScope.declare(identifier);
    });
    closedVarIdentifiers.forEach((identifier) => {
      this.functionScope.currentBlockScope.declare(identifier);
      this.closedVars.add(identifier);
    });
  }

  public compileModule(ast: SyntaxNode) {
    const startJumpPos = 0;
    this.constantsTable.buffer.pushUint32(0);

    // this.functionScope.currentBlockScope.declare

    this.compileNode(ast);
    this.instructionBuffer.pushUint8(OpCode.CODESTOP);
    this.instructionBuffer.compact();

    const constantIndex = this.constantsTable.putBuffer(this.instructionBuffer.buffer);
    this.constantsTable.buffer.backpatch(startJumpPos, () => {
      this.constantsTable.buffer.pushUint32(constantIndex);
    });

    this.constantsTable.buffer.compact();
    return this.constantsTable.buffer;
  }

  private compileNode(node: SyntaxNode): void {
    return node.accept(this);
  }
  private compileNodeList(nodeList: Array<SyntaxNode>): void {
    nodeList.forEach((statementNode) => {
      this.compileNode(statementNode);
    })
  }

  private static readonly _binaryTokenTypeToOpCodeMap: Map<TokenType, OpCode> = new Map([
    [TokenType.OP_MINUS, OpCode.NEGATE],
    [TokenType.OP_BANG, OpCode.LOGICAL_NOT],
    [TokenType.OP_PLUS, OpCode.ADD],
    [TokenType.OP_MINUS, OpCode.SUBTRACT],
    [TokenType.OP_MULT, OpCode.MULTIPLY],
    [TokenType.OP_DIV, OpCode.DIVIDE],
    [TokenType.OP_LT, OpCode.LT],
    [TokenType.OP_LTE, OpCode.LTE],
    [TokenType.OP_GT, OpCode.GT],
    [TokenType.OP_GTE, OpCode.GTE],
    [TokenType.OP_EQ, OpCode.EQ],
    [TokenType.OP_NEQ, OpCode.NEQ],
  ])
  visitBinary(node: BinarySyntaxNode): void {
    const opCode = Compiler._binaryTokenTypeToOpCodeMap.get(node.op.type)
    if (opCode === undefined) {
      throw new Error(`impossible: unrecognized binary op token ${TokenType[node.op.type]}`)
    }
    this.compileNode(node.left);
    this.compileNode(node.right);
    this.instructionBuffer.pushUint8(opCode);
  }
  private static readonly _unaryTokenTypeToOpCodeMap: Map<TokenType, OpCode> = new Map([
    [TokenType.OP_MINUS, OpCode.NEGATE],
    [TokenType.OP_BANG, OpCode.LOGICAL_NOT],
  ])
  visitUnary(node: UnarySyntaxNode): void {
    const opCode = Compiler._unaryTokenTypeToOpCodeMap.get(node.op.type);
    if (opCode === undefined) {
      throw new Error(`impossible: unrecognized unary op token ${TokenType[node.op.type]}`);
    }
    this.compileNode(node.right);
    this.instructionBuffer.pushUint8(opCode);
  }
  visitLiteral(node: LiteralSyntaxNode): void {
    let constantIndex = 0;
    switch (node.type) {
      case ValueType.NULL:
        constantIndex = this.constantsTable.putUint32(0);
        break;
      case ValueType.BOOLEAN:
        constantIndex = this.constantsTable.putUint32((node.value as boolean) ? 1 : 0);
        break;
      case ValueType.NUMBER:
        constantIndex = this.constantsTable.putFloat32((node.value as number));
        break;
      default:
        throw new Error("TODO: unsupported constant type");
    }
    if (constantIndex > 2 ** 32 - 1) {
      throw new Error(`constantIndex too big to fit in opcode argument uint32! too many constants!`);
    }

    this.instructionBuffer.pushUint8(OpCode.PUSH_CONSTANT);
    this.instructionBuffer.pushUint32(constantIndex);
  }
  visitGrouping(node: GroupingSyntaxNode): void {
    this.compileNode(node.expr);
  }
  private backpatchRelativeJumpToHere(pos: number) {
    const dest = this.instructionBuffer.byteCursor;
    const dist = Math.abs(dest - (pos + 2)); // +2 to account for having read the uint16 dist
    if (dist > 2 ** 16 -1) { throw new Error("jump dist max size is 2 ** 16 - 1 bytes"); }
    this.instructionBuffer.backpatch(pos, () => {
      this.instructionBuffer.pushUint16(dist);
    });
  }
  visitIfStatement(node: IfStatementSyntaxNode): void {
    const IB = this.instructionBuffer;
    this.compileNode(node.cond);
    IB.pushUint8(OpCode.JUMP_FORWARD_IF_POP_FALSE);
    const ifJumpPos = IB.byteCursor;
    IB.pushUint16(0);
    this.compileNode(node.thenBranch);
    let thenJumpPos = 0;
    if (node.elseBranch !== null) {
      IB.pushUint8(OpCode.JUMP_FORWARD)
      thenJumpPos = IB.byteCursor;
      IB.pushUint16(0);
    }
    this.backpatchRelativeJumpToHere(ifJumpPos);
    if (node.elseBranch !== null) {
      this.compileNode(node.elseBranch);
      this.backpatchRelativeJumpToHere(thenJumpPos);
    }
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): void {
    const IB = this.instructionBuffer;
    const whileStartPos = IB.byteCursor;
    this.compileNode(node.cond);
    IB.pushUint8(OpCode.JUMP_FORWARD_IF_POP_FALSE);
    const skipLoopJumpPos = IB.byteCursor;
    IB.pushUint16(0);
    this.compileNode(node.loopBody);
    IB.pushUint8(OpCode.JUMP_BACKWARD);
    IB.pushUint16(whileStartPos);
    this.backpatchRelativeJumpToHere(skipLoopJumpPos);
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): void {
    this.compileNode(node.left);
    const isOpOr = node.op.type === TokenType.OP_OR;
    const IB = this.instructionBuffer;
    IB.pushUint8(isOpOr ? OpCode.JUMP_BOOLEAN_OR : OpCode.JUMP_BOOLEAN_AND);
    const skipRightJumpPos = IB.byteCursor;
    IB.pushUint16(0);
    this.compileNode(node.right);
    this.backpatchRelativeJumpToHere(skipRightJumpPos);
  }

  private popLocals() {
    this.functionScope.currentBlockScope.forEachLocalInReverse((isRequiredByClosure) => {
      this.instructionBuffer.pushUint8(isRequiredByClosure ? OpCode.CLOSE_VAR : OpCode.POP);
    });
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): void {
    this.functionScope.pushBlockScope();
    this.compileNodeList(node.statementList);
    this.popLocals();
    this.functionScope.popBlockScope();
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): void {
    const identifier = node.identifier.lexeme;
    const callFrameOffset = this.functionScope.declareOrAssign(identifier, node.modifier !== null);
    if (node.rvalue !== null) {
      this.compileNode(node.rvalue);
      // if declaring, the value is already where it needs to be on the stack! if not declaring, we'll need to copy the top stack value to the variable
      if (node.modifier === null) {
        const isClosedVar = this.closedVars.has(identifier);
        this.instructionBuffer.pushUint8(isClosedVar ? OpCode.ASSIGN_CALLFRAME_CLOSED_VAR : OpCode.ASSIGN_CALLFRAME_VALUE); 
        this.instructionBuffer.pushUint8(callFrameOffset);
      }
    }
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): void {
    const identifier = node.identifier.lexeme;
    const builtin = builtinsByName.get(identifier);
    if (builtin !== undefined) {
      this.instructionBuffer.pushUint8(OpCode.PUSH_BUILTIN);
      this.instructionBuffer.pushUint16(builtin.id);
      return;
    }
    const isClosedVar = this.closedVars.has(identifier);
    const callFrameOffset = this.functionScope.lookup(identifier);
    this.instructionBuffer.pushUint8(isClosedVar ? OpCode.FETCH_CALLFRAME_CLOSED_VAR : OpCode.FETCH_CALLFRAME_VALUE);
    this.instructionBuffer.pushUint8(callFrameOffset);
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): void {
    const closedVars = this.closedVarsByFunctionNode.get(node) ?? [];
    const fnCompiler = new Compiler(this, this.context);
    fnCompiler.declareParametersAndClosedVars(node.parameterList.map(token => token.lexeme), closedVars);
    fnCompiler.compileNodeList(node.statementList);
    fnCompiler.popLocals();
    fnCompiler.instructionBuffer.pushUint8(OpCode.CODESTOP);
    fnCompiler.instructionBuffer.compact();
    const constantIndex = this.constantsTable.putBuffer(fnCompiler.instructionBuffer.buffer); // safe because all jumps are relative and all references to constants table have already been added
    this.instructionBuffer.pushUint8(OpCode.PUSH_CLOSURE);
    this.instructionBuffer.pushUint32(constantIndex);
    this.instructionBuffer.pushUint8(closedVars.length);
    closedVars.forEach((closedVar) => {
      const callFrameOffset = this.functionScope.currentBlockScope.findIdentifierInStack(closedVar);
      if (callFrameOffset === null) { throw new Error(`closedVar not found!?`) }
      this.instructionBuffer.pushUint8(callFrameOffset);
      this.functionScope.currentBlockScope.markVariableAsRequiredByClosure(closedVar);
    });
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): void {
    node.argumentList.forEach((argument) => {
      this.compileNode(argument);
    });
    this.compileNode(node.callee);
    this.instructionBuffer.pushUint8(OpCode.CALL); // responsible for pushing closed vars onto stack
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
    if (node.retvalExpr !== null) {
      this.compileNode(node.retvalExpr);
    }
    this.instructionBuffer.pushUint8(OpCode.RETURN);
  }
}

class ClosedVar {
  constructor(
    public parentOffset: number,
    public localOffset: number,
  ) { }
}

class CompilerFunctionScope {
  public constructor(
    private parentFunctionScope: CompilerFunctionScope | null,
    // private closedVars: Array<string>,
  ) {
  }
  // private closedVars: Map<string, ClosedVar> = new Map();
  // public get closedVarsCount() { return this.closedVars.size }
  // public closedVarsForeach(callbackfn: (value: ClosedVar, key: string, map: Map<string, ClosedVar>) => void) { this.closedVars.forEach(callbackfn) }
  private _currentBlockScope: CompilerBlockScope = new CompilerBlockScope(null, 0);
  public get currentBlockScope() { return this._currentBlockScope }
  public pushBlockScope() {
    this._currentBlockScope = new CompilerBlockScope(this._currentBlockScope, this._currentBlockScope.localsCount)
  }
  public popBlockScope() {
    const outerScope = this._currentBlockScope.parentScope;
    if (outerScope === null) {
      throw new Error(`popBlockScope without pushBlockScope!`);
    }
    const blockSpecificLocalCount = this._currentBlockScope.localsCount - outerScope.localsCount;
    this._currentBlockScope = outerScope;
    return blockSpecificLocalCount;
  }
  // private maybeCloseVar(identifier: string) {
  //   if (this.parentFunctionScope === null) { throw new Error(`cannot close var ${identifier} from top scope!`) }
  //   const alreadyClosedOffset = this.closedVars.get(identifier);
  //   if (alreadyClosedOffset !== undefined) { return alreadyClosedOffset.localOffset }
  //   // if the variable is in local scope, we don't need to close over it
  //   const localOffset = this._currentBlockScope.findIdentifierInStack(identifier);
  //   if (localOffset !== null) {
  //     return localOffset;
  //   }
  //   // get offset in parent function's locals (and recursively close it in parents, if necessary)
  //   const parentOffset = this.parentFunctionScope.maybeCloseVar(identifier);
  //   // register new closed var
  //   const newClosedOffset = -1 - this.closedVars.size; // n.b. backwards from -1!
  //   this.closedVars.set(identifier, new ClosedVar(parentOffset, newClosedOffset));
  //   return newClosedOffset;
  // }
  public declareOrAssign(identifier: string, isDeclaration: boolean): number {
    if (isDeclaration) {
      return this._currentBlockScope.declare(identifier); // new local offset
    }
    const localOffset = this._currentBlockScope.findIdentifierInStack(identifier);
    if (localOffset !== null) { return localOffset }
    throw new Error(`declareOrAssign cannot find var ${identifier}`);
  }
  public lookup(identifier: string): number {
    const localOffset = this._currentBlockScope.findIdentifierInStack(identifier);
    if (localOffset !== null) { return localOffset }
    throw new Error(`lookup cannot find var ${identifier}`);
  }
}

class CompilerBlockScope {
  private callFrameOffsets: Map<string, number> = new Map();
  public localIdentifiers: Array<string> = [];
  private localsWhichNeedToBeClosed: Set<number> = new Set();
  public constructor(
    public parentScope: CompilerBlockScope | null,
    public localsCount: number, // includes parameters and stack variables
  ) { }
  public declare(identifier: string): number {
    const callFrameOffset = this.localsCount;
    this.callFrameOffsets.set(identifier, callFrameOffset);
    this.localIdentifiers.push(identifier);
    this.localsCount += 1;
    return callFrameOffset;
  }
  public findIdentifierInStack(identifier: string): number | null {
    const callFrameOffset = this.callFrameOffsets.get(identifier);
    if (callFrameOffset !== undefined) {
      return callFrameOffset;
    }
    if (this.parentScope !== null) {
      return this.parentScope.findIdentifierInStack(identifier);
    }
    return null;
  }
  public markVariableAsRequiredByClosure(identifier: string) {
    const callFrameOffset = this.callFrameOffsets.get(identifier);
    if (callFrameOffset !== undefined) {
      this.localsWhichNeedToBeClosed.add(callFrameOffset);
    }
    else {
      if (this.parentScope !== null) {
        this.parentScope.markVariableAsRequiredByClosure(identifier);
      }
      else {
        throw new Error(`could not mark variable as required by closure because it wasn't found in block scope`);
      }
    }
  }
  public forEachLocalInReverse(callbackfn: (isRequiredByClosure: boolean) => void) {
    for (let i = 0; i < this.callFrameOffsets.size; i += 1) {
      const callFrameOffset = (this.localsCount - 1) - i;
      const isRequiredByClosure = this.localsWhichNeedToBeClosed.has(callFrameOffset);
      callbackfn(isRequiredByClosure);
    }
  }
}

