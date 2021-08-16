import assert from "assert"
import { Token, TokenType } from "../Token"
import { SyntaxNodeVisitor, SyntaxNode, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode, TypeDeclarationSyntaxNode, ClassDeclarationSyntaxNode } from "../syntax/syntax"
import { ByteBuffer } from "../../bytecode/ByteBuffer"
import { OpCode } from "../../bytecode/opcodes"
import { ValueType } from "../syntax/ValueType"
import { ConstantsTable } from "./ConstantsTable"
import { builtinsByName } from "../../builtins/builtins"
import { resolve } from "../resolver/resolver"
import { ResolverOutput, ResolverVariableDetails } from "../resolver/resolverOutput"

export function generateBytecode(source: string, path: string) {
  const { ast, resolverOutput } = resolve(source, path);
  const context = new BytecodeGeneratorContext(new ConstantsTable(), resolverOutput);
  return new BytecodeGenerator(context, null, ast).compileModule(ast);
}

class BytecodeGeneratorContext {
  public constructor(
    public constantsTable: ConstantsTable,
    public resolverOutput: ResolverOutput,
  ) { }
}

class BytecodeGenerator implements SyntaxNodeVisitor<void> {
  private functionScope: BytecodeGeneratorFunctionScope;
  private instructionBuffer: ByteBuffer = new ByteBuffer();
  constructor(
    private context: BytecodeGeneratorContext,
    parentBytecodeGenerator: BytecodeGenerator | null,
    private node: SyntaxNode,
  ) {
    this.functionScope = new BytecodeGeneratorFunctionScope(this.context, parentBytecodeGenerator?.functionScope ?? null, this.node);
  }
  private get constantsTable() { return this.context.constantsTable }
  private getClosedVarsByFunctionNode(node: SyntaxNode) { return this.context.resolverOutput.decoratedNodes.get(node)?.closedVars ?? [] }

  public declareParametersAndClosedVars(parameterIdentifiers: Array<string>, closedVarIdentifiers: Array<string>) {
    // const parameterOffsetsToPromoteToHeap: Array<number> = [];
    parameterIdentifiers.forEach((identifier) => {
      const callFrameVarInfo = this.functionScope.currentBlockScope.declare(identifier);
      if (callFrameVarInfo.resolverVarDetails.isClosed) {
        // console.log(`  PARAMETER TO BE PROMOTED TO HEAP: ${identifier}`)
        // parameterOffsetsToPromoteToHeap.push(callFrameVarInfo.callFrameOffset);
        this.instructionBuffer.pushUint8(OpCode.PROMOTE_PARAM_TO_HEAP);
        this.instructionBuffer.pushUint8(callFrameVarInfo.callFrameOffset);
      }
    });
    closedVarIdentifiers.forEach((identifier) => {
      this.functionScope.currentBlockScope.declare(identifier);
    });
    this.functionScope.currentBlockScope.addPlaceholders();
  }

  public compileModule(ast: SyntaxNode) {
    const startJumpPos = 0;
    this.constantsTable.buffer.pushUint32(0);

    // this.functionScope.currentBlockScope.declare

    this.compileNode(ast);
    this.instructionBuffer.pushUint8(OpCode.CODESTOP);
    this.instructionBuffer.compact();

    const constantIndex = this.constantsTable.storeBuffer(this.instructionBuffer.buffer);
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
    [TokenType.MINUS, OpCode.NEGATE],
    [TokenType.BANG, OpCode.LOGICAL_NOT],
    [TokenType.PLUS, OpCode.ADD],
    [TokenType.MINUS, OpCode.SUBTRACT],
    [TokenType.ASTERISK, OpCode.MULTIPLY],
    [TokenType.FORWARD_SLASH, OpCode.DIVIDE],
    [TokenType.LESS_THAN, OpCode.LT],
    [TokenType.LESS_THAN_OR_EQUAL, OpCode.LTE],
    [TokenType.GREATER_THAN, OpCode.GT],
    [TokenType.GREATER_THAN_OR_EQUAL, OpCode.GTE],
    [TokenType.DOUBLE_EQUAL, OpCode.EQ],
    [TokenType.BANG_EQUAL, OpCode.NEQ],
  ])
  visitBinary(node: BinarySyntaxNode): void {
    const opCode = BytecodeGenerator._binaryTokenTypeToOpCodeMap.get(node.op.type)
    if (opCode === undefined) {
      throw new Error(`impossible: unrecognized binary op token ${TokenType[node.op.type]}`)
    }
    this.compileNode(node.left);
    this.compileNode(node.right);
    this.instructionBuffer.pushUint8(opCode);
  }
  private static readonly _unaryTokenTypeToOpCodeMap: Map<TokenType, OpCode> = new Map([
    [TokenType.MINUS, OpCode.NEGATE],
    [TokenType.BANG, OpCode.LOGICAL_NOT],
  ])
  visitUnary(node: UnarySyntaxNode): void {
    const opCode = BytecodeGenerator._unaryTokenTypeToOpCodeMap.get(node.op.type);
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
        constantIndex = this.constantsTable.storeUniqueUint32(0);
        break;
      case ValueType.BOOLEAN:
        constantIndex = this.constantsTable.storeUniqueFloat32((node.value as boolean) ? 1 : 0);
        break;
      case ValueType.NUMBER:
        constantIndex = this.constantsTable.storeUniqueFloat32((node.value as number));
        break;
      default:
        throw new Error("unsupported constant type");
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
    const isOpOr = node.op.type === TokenType.DOUBLE_PIPE;
    const IB = this.instructionBuffer;
    IB.pushUint8(isOpOr ? OpCode.JUMP_BOOLEAN_OR : OpCode.JUMP_BOOLEAN_AND);
    const skipRightJumpPos = IB.byteCursor;
    IB.pushUint16(0);
    this.compileNode(node.right);
    this.backpatchRelativeJumpToHere(skipRightJumpPos);
  }

  private popLocals() {
    const localCount = this.functionScope.currentBlockScope.getLocalCount();
    this.instructionBuffer.pushUint8(OpCode.POP_N);
    this.instructionBuffer.pushUint8(localCount);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): void {
    this.functionScope.pushBlockScope(node);
    this.compileNodeList(node.statementList);
    this.popLocals();
    this.functionScope.popBlockScope();
  }
  visitClassDeclaration(_node: ClassDeclarationSyntaxNode): void {
    // TODO: methods need to be written to constants table
  }
  visitTypeDeclaration(_node: TypeDeclarationSyntaxNode): void {
    // pass
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): void {
    const identifier = node.identifier.lexeme;
    const callFrameVarInfo = this.functionScope.declareOrAssign(identifier, node.modifier !== null);
    if (node.rvalue !== null) {
      this.compileNode(node.rvalue);
      if (callFrameVarInfo.resolverVarDetails.isClosed) {
        if (node.modifier !== null) {
          // if declaring, we'll swap the top stack value with the location of the allocation
          this.instructionBuffer.pushUint8(OpCode.ALLOC_SCALAR);
        }
        else {
          this.instructionBuffer.pushUint8(OpCode.ASSIGN_PTR);
          this.instructionBuffer.pushUint8(callFrameVarInfo.callFrameOffset);
        }
      }
      else {
        // if declaring, the value is already where it needs to be on the stack! if not declaring, we'll need to copy the top stack value to the variable
        if (node.modifier === null) {
          this.instructionBuffer.pushUint8(OpCode.ASSIGN_CALLFRAME_VALUE);
          this.instructionBuffer.pushUint8(callFrameVarInfo.callFrameOffset);
        }
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
    const callFrameVarInfo = this.functionScope.lookup(identifier);
    this.instructionBuffer.pushUint8(OpCode.FETCH_CALLFRAME_VALUE);
    this.instructionBuffer.pushUint8(callFrameVarInfo.callFrameOffset);
    if (callFrameVarInfo.resolverVarDetails.isRef) {
      this.instructionBuffer.pushUint8(OpCode.DEREF);
    }
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): void {
    const closedVars = this.getClosedVarsByFunctionNode(node);
    const fnBytecodeGenerator = new BytecodeGenerator(this.context, this, node);
    fnBytecodeGenerator.declareParametersAndClosedVars(node.parameterList.map(parameter => parameter.identifier.lexeme), closedVars);
    fnBytecodeGenerator.compileNodeList(node.statementList);
    fnBytecodeGenerator.popLocals();
    fnBytecodeGenerator.instructionBuffer.pushUint8(OpCode.CODESTOP);
    fnBytecodeGenerator.instructionBuffer.compact();
    const constantIndex = this.constantsTable.storeBuffer(fnBytecodeGenerator.instructionBuffer.buffer); // safe because all jumps are relative and all references to constants table have already been added
    this.instructionBuffer.pushUint8(OpCode.DEFINE_FUNCTION);
    this.instructionBuffer.pushUint32(constantIndex);
    this.instructionBuffer.pushUint8(closedVars.length);
    closedVars.forEach((closedVar) => {
      const callFrameVarInfo = this.functionScope.currentBlockScope.findIdentifierInStack(closedVar);
      if (callFrameVarInfo === null) { throw new Error(`closedVar not found!?`) }
      this.instructionBuffer.pushUint8(callFrameVarInfo.callFrameOffset);
      // this.functionScope.currentBlockScope.markVariableAsRequiredByClosure(closedVar);
    });
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): void {
    node.argumentList.forEach((argument) => {
      this.compileNode(argument);
    });
    this.compileNode(node.callee);
    this.instructionBuffer.pushUint8(OpCode.CALL); // responsible for pushing closed vars onto stack
    this.instructionBuffer.pushUint8(node.argumentList.length);
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
    if (node.retvalExpr !== null) {
      this.compileNode(node.retvalExpr);
    }
    this.instructionBuffer.pushUint8(OpCode.RETURN);
  }
}

class CallFrameVarInfo {
  constructor(
    public callFrameOffset: number,
    public resolverVarDetails: ResolverVariableDetails,
  ) { }
}

class BytecodeGeneratorFunctionScope {
  private _currentBlockScope: BytecodeGeneratorBlockScope;
  public constructor(
    private context: BytecodeGeneratorContext,
    private parentFunctionScope: BytecodeGeneratorFunctionScope | null,
    private node: SyntaxNode,
  ) {
    this._currentBlockScope = new BytecodeGeneratorBlockScope(this.context, null, 0, this.node);
  }
  public get currentBlockScope() { return this._currentBlockScope }
  public pushBlockScope(node: SyntaxNode) {
    this._currentBlockScope = new BytecodeGeneratorBlockScope(this.context, this._currentBlockScope, this._currentBlockScope.localsCount, node)
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
  public declareOrAssign(identifier: string, isDeclaration: boolean): CallFrameVarInfo {
    if (isDeclaration) {
      return this._currentBlockScope.declare(identifier); // new local offset
    }
    const localVarInfo = this._currentBlockScope.findIdentifierInStack(identifier);
    if (localVarInfo !== null) { return localVarInfo }
    throw new Error(`declareOrAssign cannot find var ${identifier}`);
  }
  public lookup(identifier: string): CallFrameVarInfo {
    const localVarInfo = this._currentBlockScope.findIdentifierInStack(identifier);
    if (localVarInfo !== null) { return localVarInfo }
    throw new Error(`lookup cannot find var ${identifier}`);
  }
}

class BytecodeGeneratorBlockScope {
  private callFrameOffsets: Map<string, number> = new Map();
  public localIdentifiers: Array<string> = [];
  //private localsWhichNeedToBeClosed: Set<number> = new Set();
  public constructor(
    private context: BytecodeGeneratorContext,
    public parentScope: BytecodeGeneratorBlockScope | null,
    public localsCount: number, // includes parameters and stack variables
    private node: SyntaxNode,
  ) { }
  public addPlaceholders() {
    this.localsCount += 2; // support return address and callframe jumpback distance in stack
  }
  private findVarDetails(identifier: string): ResolverVariableDetails {
    const declaredVars = this.context.resolverOutput.decoratedNodes.get(this.node)?.declaredVars!;
    const x = declaredVars[identifier];
    return x ?? this.parentScope?.findVarDetails(identifier);
  }
  public declare(identifier: string): CallFrameVarInfo {
    const resolverVarDetails = this.findVarDetails(identifier);
    if (resolverVarDetails === undefined) { throw new Error(`BytecodeGenerator could not find var declaration by resolver for ${identifier}`) }
    const callFrameOffset = this.localsCount;
    this.callFrameOffsets.set(identifier, callFrameOffset);
    this.localIdentifiers.push(identifier);
    this.localsCount += 1;
    return new CallFrameVarInfo(callFrameOffset, resolverVarDetails);
  }
  public findIdentifierInStack(identifier: string): CallFrameVarInfo | null {
    const callFrameOffset = this.callFrameOffsets.get(identifier);
    if (callFrameOffset !== undefined) {
      const resolverVarDetails = this.findVarDetails(identifier);
      if (resolverVarDetails === undefined) { throw new Error(`BytecodeGenerator could not find var declaration by resolver for ${identifier}`) }
      return new CallFrameVarInfo(callFrameOffset, resolverVarDetails);
    }
    if (this.parentScope !== null) {
      return this.parentScope.findIdentifierInStack(identifier);
    }
    return null;
  }
  public getLocalCount() {
    return this.localIdentifiers.length;
  }
}

