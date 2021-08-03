import { Token } from "../Token"
import { ValueType } from "./ValueType"

export interface SyntaxNodeVisitor<T> {
  visitBinary(node: BinarySyntaxNode): T;
  visitUnary(node: UnarySyntaxNode): T;
  visitLiteral(node: LiteralSyntaxNode): T;
  visitGrouping(node: GroupingSyntaxNode): T;
  visitStatementBlock(node: StatementBlockSyntaxNode): T;
  visitIfStatement(node: IfStatementSyntaxNode): T;
  visitWhileStatement(node: WhileStatementSyntaxNode): T;
  visitReturnStatement(node: ReturnStatementSyntaxNode): T;
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): T;
  visitVariableLookup(node: VariableLookupSyntaxNode): T;
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): T;
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): T;
  visitFunctionCall(node: FunctionCallSyntaxNode): T;
}

export abstract class SyntaxNode {
  public constructor(
    public referenceToken: Token,
  ) { }
  public abstract accept<R>(visitor: SyntaxNodeVisitor<R>): R;
}

export class BinarySyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public left: SyntaxNode,
    public op: Token,
    public right: SyntaxNode,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitBinary(this);
  }
}

export class UnarySyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public op: Token,
    public right: SyntaxNode,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitUnary(this);
  }
}

export class LiteralSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public value: unknown,
    public type: ValueType,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitLiteral(this);
  }
}

export class GroupingSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public expr: SyntaxNode,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitGrouping(this);
  }
}

export class StatementBlockSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public statementList: Array<SyntaxNode>,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitStatementBlock(this);
  }
}

export class IfStatementSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public cond: SyntaxNode,
    public thenBranch: StatementBlockSyntaxNode,
    public elseBranch: SyntaxNode | null,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitIfStatement(this);
  }
}

export class WhileStatementSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public cond: SyntaxNode,
    public loopBody: StatementBlockSyntaxNode,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitWhileStatement(this);
  }
}

export class ReturnStatementSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public retvalExpr: SyntaxNode | null,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitReturnStatement(this);
  }
}

export class LogicShortCircuitSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public left: SyntaxNode,
    public op: Token,
    public right: SyntaxNode,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitLogicShortCircuit(this);
  }
}

export class VariableLookupSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public identifier: Token,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitVariableLookup(this);
  }
}

export class VariableAssignmentSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public modifier: Token | null,
    public identifier: Token,
    public rvalue: SyntaxNode | null,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitVariableAssignment(this);
  }
}

export class FunctionDefinitionSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public parameterList: Array<Token>,
    public statementList: Array<SyntaxNode>,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitFunctionDefinition(this);
  }
}

export class FunctionCallSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public callee: SyntaxNode,
    public argumentList: Array<SyntaxNode>,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitFunctionCall(this);
  }
}
