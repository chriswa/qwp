import { TokenType } from "../Token"
import { SyntaxNodeVisitor, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode, IfStatementSyntaxNode, WhileStatementSyntaxNode, LogicShortCircuitSyntaxNode, VariableLookupSyntaxNode, VariableAssignmentSyntaxNode, FunctionCallSyntaxNode, FunctionHomonymSyntaxNode, ReturnStatementSyntaxNode } from "./syntax"

/*
export class AstPrinter implements SyntaxNodeVisitor<string> {
  indentLevel = 0;
  indent() {
    return "  ".repeat(this.indentLevel);
  }
  visitBinary(node: BinarySyntaxNode): string {
    return `${node.left.accept(this)} ${TokenType[node.op.type]} ${node.right.accept(this)}`;
  }
  visitUnary(node: UnarySyntaxNode): string {
    return `${node.op} ${node.right.accept(this)}`;
  }
  visitLiteral(node: LiteralSyntaxNode): string {
    return `${node.value}`;
  }
  visitGrouping(node: GroupingSyntaxNode): string {
    return `(${node.expr.accept(this)})`;
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): string {
    return node.statementList.map(statement => this.indent() + statement.accept(this) + ";").join("\n");
  }
  visitIfStatement(node: IfStatementSyntaxNode): string {
    this.indentLevel += 1;
    let output = `${this.indent()}if (${node.cond.accept(this)}) {\n${node.thenBranch.accept(this)}${this.indent()}}\n`;
    if (node.elseBranch !== null) {
      output += `${this.indent()}else {\n${node.elseBranch.accept(this)}}\n`
    }
    this.indentLevel -= 1;
    return output;
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): string {
    this.indentLevel += 1;
    let output = `${this.indent()}while (${node.cond.accept(this)}) {\n${node.loopBody.accept(this)}${this.indent()}}\n`;
    this.indentLevel -= 1;
    return output;
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): string {
    return `${node.left.accept(this)} ${TokenType[node.op.type]} ${node.right.accept(this)}`;
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): string {
    return node.identifier.lexeme;
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): string {
    return (node.modifier === null ? "" : `${node.modifier.lexeme} `) + node.lvalue.lexeme + " = " + node.rvalue.acc;
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): string {
    return ``;
  }
  visitFunctionHomonym(node: FunctionDefinitionSyntaxNode): string {
    return ``;
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): string {
    return ``;
  }
}
*/
