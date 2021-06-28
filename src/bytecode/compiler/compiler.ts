import assert from "assert"
import { Token, TokenType } from "../../sourcecode/parser/Token"
import { SyntaxNodeVisitor, SyntaxNode, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionDefinitionSyntaxNode, FunctionCallSyntaxNode, ReturnStatementSyntaxNode } from "../../sourcecode/syntax/syntax"
import { ByteBuffer } from "./ByteBuffer"



export class Compiler implements SyntaxNodeVisitor<void> {
  private instructionBuffer: ByteBuffer;
  constructor(node: SyntaxNode) {
    this.instructionBuffer = new ByteBuffer();
  }
  public getByteCode(): Uint8Array {
    return this.instructionBuffer.getCompacted(); // TODO: anything else?
  }

  private evaluate(node: SyntaxNode): void {
    return node.accept(this);
  }
  visitBinary(node: BinarySyntaxNode): void {
  }
  visitUnary(node: UnarySyntaxNode): void {
  }
  visitLiteral(node: LiteralSyntaxNode): void {
  }
  visitGrouping(node: GroupingSyntaxNode): void {
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): void {
  }
  visitIfStatement(node: IfStatementSyntaxNode): void {
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): void {
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): void {
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

