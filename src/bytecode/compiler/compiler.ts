import assert from "assert"
import { Token, TokenType } from "../../sourcecode/parser/Token"
import { SyntaxNodeVisitor, SyntaxNode, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode } from "../../sourcecode/syntax/syntax"
import { ByteBuffer } from "./ByteBuffer"
import { OpCode } from "../opcodes"

export function compile(ast: SyntaxNode) {
  return new Compiler().compileModule(ast);
}

// class Constant {
//   constructor(
//     // private identifier: string,
//   ) { }
// }

class ConstantsTable {
  public readonly buffer: ByteBuffer = new ByteBuffer();
  // private map: Map<string, Constant> = new Map();
}

class Compiler implements SyntaxNodeVisitor<void> {
  private instructionBuffer: ByteBuffer = new ByteBuffer();
  private constantsTable: ConstantsTable = new ConstantsTable();
  constructor() {
  }
  public compileModule(ast: SyntaxNode) {
    this.compileNode(ast);
    this.instructionBuffer.compact()
    return {
      instructions: this.instructionBuffer,
      constants: this.constantsTable.buffer,
    };
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
    this.instructionBuffer.writeUInt8(opCode);
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
    this.instructionBuffer.writeUInt8(opCode);
  }
  visitLiteral(node: LiteralSyntaxNode): void {
    throw new Error("TODO: constants table");
    // const constantIndex = this.constantsTable.put(node.type, node.value);
    // this.instructionBuffer.writeUInt8(OpCode.CONSTANT);
    // this.instructionBuffer.writeUInt8(constantIndex);
  }
  visitGrouping(node: GroupingSyntaxNode): void {
    this.compileNode(node.expr);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): void {
    // TODO: scope?
    this.compileNodeList(node.statementList);
  }
  private backpatchRelativeJump(pos: number, dest: number) {
    const dist = Math.abs(dest - (pos + 2));
    if (dist > 2 ** 16 -1) { throw new Error("jump dist max size is 2 ** 16 - 1 bytes"); }
    this.instructionBuffer.backpatch(pos, () => {
      this.instructionBuffer.writeUInt16(dist);
    });
  }
  visitIfStatement(node: IfStatementSyntaxNode): void {
    const IB = this.instructionBuffer;
    this.compileNode(node.cond);
    IB.writeUInt8(OpCode.JUMP_FORWARD_IF_FALSE);
    const ifJumpPos = IB.byteCursor;
    IB.writeUInt16(0);
    this.compileNode(node.thenBranch);
    let thenJumpPos = 0;
    if (node.elseBranch !== null) {
      IB.writeUInt8(OpCode.JUMP_FORWARD)
      thenJumpPos = IB.byteCursor
      IB.writeUInt16(0)
    }
    const thenEndPos = IB.byteCursor
    this.backpatchRelativeJump(ifJumpPos, thenEndPos);
    if (node.elseBranch !== null) {
      this.compileNode(node.elseBranch);
      const elseEndPos = IB.byteCursor;
      this.backpatchRelativeJump(thenJumpPos, elseEndPos);
    }
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): void {
    const IB = this.instructionBuffer;
    const whileStartPos = IB.byteCursor;
    this.compileNode(node.cond);
    IB.writeUInt8(OpCode.JUMP_FORWARD_IF_FALSE);
    const skipLoopJumpPos = IB.byteCursor;
    IB.writeUInt16(0);
    this.compileNode(node.loopBody);
    IB.writeUInt8(OpCode.JUMP_BACKWARD);
    const continueJumpPos = IB.byteCursor;
    IB.writeUInt16(0);
    const whileEndPos = IB.byteCursor;
    this.backpatchRelativeJump(continueJumpPos, whileStartPos);
    this.backpatchRelativeJump(skipLoopJumpPos, whileEndPos);
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
    if (node.retvalExpr === null) {
      this.instructionBuffer.writeUInt8(OpCode.RETURN_VOID);
    }
    else {
      this.compileNode(node.retvalExpr);
      this.instructionBuffer.writeUInt8(OpCode.RETURN_VALUE);
    }
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): void {
    throw new Error(`TODO: needs to use a conditional jump to skip node.right!`);
    const isOpOr = node.op.type === TokenType.OP_OR;
    this.compileNode(node.left);
    this.instructionBuffer.writeUInt8(isOpOr ? OpCode.LOGICAL_OR : OpCode.LOGICAL_AND);
    this.compileNode(node.right);
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): void {
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): void {
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): void {
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): void {
  }
}

