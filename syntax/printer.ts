import { TokenType } from "../parser/Token"
import { SyntaxNodeVisitor, BinarySyntaxNode, UnarySyntaxNode, LiteralSyntaxNode, GroupingSyntaxNode, StatementBlockSyntaxNode } from "./syntax"

export class AstPrinter implements SyntaxNodeVisitor<string> {
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
    return node.statements.map(statement => statement.accept(this) + ";").join("\n");
  }
}
