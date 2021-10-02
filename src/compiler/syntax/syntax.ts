import { Token } from '../Token'
import { ValueType } from './ValueType'
import { TypeAnnotation } from './TypeAnnotation'
import { FunctionParameter } from './FunctionParameter'
import { GenericDefinition } from './GenericDefinition'

export interface ISyntaxNodeVisitor<T> {
  // visitBinary(node: BinarySyntaxNode): T;
  // visitUnary(node: UnarySyntaxNode): T;
  visitLiteral(node: LiteralSyntaxNode): T
  visitGrouping(node: GroupingSyntaxNode): T
  visitStatementBlock(node: StatementBlockSyntaxNode): T
  visitIfStatement(node: IfStatementSyntaxNode): T
  visitWhileStatement(node: WhileStatementSyntaxNode): T
  visitReturnStatement(node: ReturnStatementSyntaxNode): T
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): T
  visitVariableLookup(node: VariableLookupSyntaxNode): T
  visitClassDeclaration(node: ClassDeclarationSyntaxNode): T
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode): T
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): T
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): T
  visitFunctionHomonym(node: FunctionHomonymSyntaxNode): T
  visitFunctionOverload(node: FunctionOverloadSyntaxNode): T
  visitFunctionCall(node: FunctionCallSyntaxNode): T
  visitMemberLookup(node: MemberLookupSyntaxNode): T
  visitMemberAssignment(node: MemberAssignmentSyntaxNode): T
}

export abstract class SyntaxNode {
  public constructor(
    public referenceToken: Token,
  ) { }
  public abstract accept<R>(visitor: ISyntaxNodeVisitor<R>): R
  public abstract kind(): string
}

export class LiteralSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public value: unknown,
    public type: ValueType,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitLiteral(this)
  }
  kind(): string {
    return 'Literal'
  }
}

export class GroupingSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public expr: SyntaxNode,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitGrouping(this)
  }
  kind(): string {
    return 'Grouping'
  }
}

export class StatementBlockSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public statementList: Array<SyntaxNode>,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitStatementBlock(this)
  }
  kind(): string {
    return 'StatementBlock'
  }
}

export class IfStatementSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public cond: SyntaxNode,
    public thenBranch: StatementBlockSyntaxNode,
    public elseBranch: StatementBlockSyntaxNode | null,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitIfStatement(this)
  }
  kind(): string {
    return 'IfStatement'
  }
}

export class WhileStatementSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public cond: SyntaxNode,
    public loopBody: StatementBlockSyntaxNode,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitWhileStatement(this)
  }
  kind(): string {
    return 'WhileStatement'
  }
}

export class ReturnStatementSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public retvalExpr: SyntaxNode | null,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitReturnStatement(this)
  }
  kind(): string {
    return 'ReturnStatement'
  }
}

export class LogicShortCircuitSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public left: SyntaxNode,
    public op: Token,
    public right: SyntaxNode,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitLogicShortCircuit(this)
  }
  kind(): string {
    return 'LogicShortCircuit'
  }
}

export class VariableLookupSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public identifier: Token,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitVariableLookup(this)
  }
  kind(): string {
    return 'VariableLookup'
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
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitTypeDeclaration(this)
  }
  kind(): string {
    return 'TypeDeclaration'
  }
}

export class ClassDeclarationSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public newClassName: Token,
    public genericDefinition: GenericDefinition | null,
    public baseClassName: Token | null,
    public implementedInterfaceNames: Array<Token>,
    public methods: Map<string, FunctionHomonymSyntaxNode>,
    public fields: Map<string, TypeAnnotation | null>,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitClassDeclaration(this)
  }
  kind(): string {
    return 'ClassDeclaration'
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
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitObjectInstantiation(this)
  }
  kind(): string {
    return 'ObjectInstantiation'
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
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitVariableAssignment(this)
  }
  kind(): string {
    return 'VariableAssignment'
  }
}

export class FunctionOverloadSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public genericDefinition: GenericDefinition | null,
    public parameterList: Array<FunctionParameter>,
    public returnTypeAnnotation: TypeAnnotation | null,
    public statementList: Array<SyntaxNode>,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitFunctionOverload(this)
  }
  kind(): string {
    return 'FunctionOverload'
  }
}

export class FunctionHomonymSyntaxNode extends SyntaxNode {
  constructor(
    public overloads: Array<FunctionOverloadSyntaxNode>,
    // public genericDefinition: GenericDefinition | null,
  ) {
    super(overloads[ 0 ].referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitFunctionHomonym(this)
  }
  kind(): string {
    return 'FunctionHomonym'
  }
}

export class FunctionCallSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public callee: SyntaxNode,
    public argumentList: Array<SyntaxNode>,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitFunctionCall(this)
  }
  kind(): string {
    return 'FunctionCall'
  }
}

export class MemberLookupSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public object: SyntaxNode,
    public memberName: Token,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitMemberLookup(this)
  }
  kind(): string {
    return 'MemberLookup'
  }
}

export class MemberAssignmentSyntaxNode extends SyntaxNode {
  constructor(
    referenceToken: Token,
    public object: SyntaxNode,
    public memberName: Token,
    public rvalue: SyntaxNode,
  ) {
    super(referenceToken)
  }
  accept<R>(visitor: ISyntaxNodeVisitor<R>): R {
    return visitor.visitMemberAssignment(this)
  }
  kind(): string {
    return 'MemberAssignment'
  }
}
