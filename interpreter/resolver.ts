import { Token } from "../parser/Token"
import { BinarySyntaxNode, FunctionCallSyntaxNode, FunctionDefinitionSyntaxNode, GroupingSyntaxNode, IfStatementSyntaxNode, LiteralSyntaxNode, LogicShortCircuitSyntaxNode, ReturnStatementSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, UnarySyntaxNode, VariableAssignmentSyntaxNode, VariableIdentifierSyntaxNode, WhileStatementSyntaxNode } from "../syntax/syntax"

export class Resolver implements SyntaxNodeVisitor<void> {
  semanticVariableDistances: Map<Token, number> = new Map();
  resolve(node: SyntaxNode) {
    node.accept(this);
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
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): void {
  }
  visitVariableIdentifier(node: VariableIdentifierSyntaxNode): void {
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): void {
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): void {
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): void {
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
  }
}
