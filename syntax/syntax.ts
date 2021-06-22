import { Token, TokenType } from "../parser/Token"

export enum ValueType {
  BOOLEAN,
  NUMBER,
  STRING,
  NULL,
}

export interface SyntaxNodeVisitor<T> {
  visitBinary(node: BinarySyntaxNode): T;
  visitUnary(node: UnarySyntaxNode): T;
  visitLiteral(node: LiteralSyntaxNode): T;
  visitGrouping(node: GroupingSyntaxNode): T;
  visitStatementBlock(node: StatementBlockSyntaxNode): T;
}

export abstract class SyntaxNode {
  public constructor(
    // private referenceToken: Token,
  ) { }
  public abstract accept<R>(visitor: SyntaxNodeVisitor<R>): R;
}

export class BinarySyntaxNode extends SyntaxNode {
  constructor(
    public left: SyntaxNode,
    public op: Token,
    public right: SyntaxNode,
  ) {
    super()
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitBinary(this);
  }
}

export class UnarySyntaxNode extends SyntaxNode {
  constructor(
    public op: Token,
    public right: SyntaxNode,
  ) {
    super()
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitUnary(this);
  }
}

export class LiteralSyntaxNode extends SyntaxNode {
  constructor(
    public value: unknown,
    public type: ValueType,
  ) {
    super()
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitLiteral(this);
  }
}

export class GroupingSyntaxNode extends SyntaxNode {
  constructor(
    public expr: SyntaxNode,
  ) {
    super()
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitGrouping(this);
  }
}

export class StatementBlockSyntaxNode extends SyntaxNode {
  constructor(
    public statements: Array<SyntaxNode>,
  ) {
    super()
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitStatementBlock(this);
  }
}
