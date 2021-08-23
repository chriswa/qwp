import { Token } from "../Token"
import { ValueType } from "./ValueType"
import { TypeAnnotation } from "./TypeAnnotation"
import { FunctionParameter } from "./FunctionParameter"
import { GenericDefinition } from "./GenericDefinition"

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
  visitClassDeclaration(node: ClassDeclarationSyntaxNode): T;
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode): T;
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): T;
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
    public elseBranch: StatementBlockSyntaxNode | null,
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

export class TypeDeclarationSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public identifier: Token,
    public genericDefinition: GenericDefinition | null,
    public typeAnnotation: TypeAnnotation,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitTypeDeclaration(this);
  }
}

export class ClassDeclarationSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public newClassName: Token,
    public genericDefinition: GenericDefinition | null,
    public baseClassName: Token | null,
    public implementedInterfaceNames: Array<Token>,
    public methods: Map<string, FunctionDefinitionSyntaxNode>,
    public fields: Map<string, TypeAnnotation | null>,
  ) {
    super(referenceToken);
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitClassDeclaration(this);
  }
}

export class ObjectInstantiationSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public className: Token,
    public constructorArgumentList: Array<SyntaxNode>,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: SyntaxNodeVisitor<R>) {
    return visitor.visitObjectInstantiation(this);
  }
}

export class VariableAssignmentSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public modifier: Token | null,
    public identifier: Token,
    public typeAnnotation: TypeAnnotation | null,
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
    public genericDefinition: GenericDefinition | null,
    public parameterList: Array<FunctionParameter>,
    public returnTypeAnnotation: TypeAnnotation | null,
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
