import { BinarySyntaxNode, FunctionCallSyntaxNode, FunctionDefinitionSyntaxNode, GroupingSyntaxNode, IfStatementSyntaxNode, LiteralSyntaxNode, LogicShortCircuitSyntaxNode, ReturnStatementSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, UnarySyntaxNode, VariableAssignmentSyntaxNode, VariableLookupSyntaxNode, WhileStatementSyntaxNode } from "../syntax/syntax"
import { INTERPRETER_BUILTINS } from "../../interpreter/builtins"
import { ParserError } from "./ParserError"

enum VariableStatus {
  BUILTIN_OR_PARAMETER,
  DECLARED,
  INITIALIZED,
};

class ResolverScope {
  table: Record<string, VariableStatus> = {};
  constructor(
    public parentScope: ResolverScope | null = null,
    preinitializedIdentifiers: Array<string>,
  ) {
    for (const identifier of preinitializedIdentifiers) {
      this.table[identifier] = VariableStatus.BUILTIN_OR_PARAMETER;
    }
  }
  public getVariableStatusFromStack(identifier: string): VariableStatus | null {
    if (identifier in this.table) {
      return this.table[identifier];
    }
    if (this.parentScope !== null) {
      return this.parentScope.getVariableStatusFromStack(identifier);
    }
    return null;
  }
  public declareVariable(identifier: string) {
    this.table[identifier] = VariableStatus.DECLARED;
  }
  public initializeVariable(identifier: string) {
    this.table[identifier] = VariableStatus.INITIALIZED;
  }
}

export class Resolver implements SyntaxNodeVisitor<void> {
  scope: ResolverScope;
  resolverErrors: Array<ParserError> = [];
  constructor() {
    this.scope = new ResolverScope(null, Object.keys(INTERPRETER_BUILTINS));
  }
  beginScope(preinitializedIdentifiers: Array<string>) {
    this.scope = new ResolverScope(this.scope, preinitializedIdentifiers);
  }
  endScope() {
    if (this.scope.parentScope === null) {
      throw new Error("internal logic error: attempted to leave global scope");
    }
    this.scope = this.scope.parentScope;
  }

  generateResolverError(node: SyntaxNode, message: string) {
    const resolverError = new ParserError(message, node.referenceToken.path, node.referenceToken.charPos);
    this.resolverErrors.push(resolverError);
    return resolverError;
  }


  resolve(node: SyntaxNode): Array<ParserError> {
    this.resolverErrors = [];
    this.resolveSyntaxNode(node);
    return this.resolverErrors;
  }

  resolveSyntaxNode(node: SyntaxNode) {
    node.accept(this);
  }
  resolveList(nodeList: Array<SyntaxNode>) {
    for (const node of nodeList) {
      this.resolveSyntaxNode(node);
    }
  }
  visitBinary(node: BinarySyntaxNode): void {
    this.resolveSyntaxNode(node.left);
    this.resolveSyntaxNode(node.right);
  }
  visitUnary(node: UnarySyntaxNode): void {
    this.resolveSyntaxNode(node.right);
  }
  visitLiteral(node: LiteralSyntaxNode): void {
    // pass
  }
  visitGrouping(node: GroupingSyntaxNode): void {
    this.resolveSyntaxNode(node.expr);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): void {
    this.beginScope([]);
    // hoist declarations
    // for (const statement of node.statementList) {
    //   if (statement instanceof VariableAssignmentSyntaxNode && statement.modifier !== null) {
    //     this.declareVariable(statement.identifier);
    //   }
    // }
    // recurse resolution
    this.resolveList(node.statementList);
    this.endScope();
  }
  visitIfStatement(node: IfStatementSyntaxNode): void {
    this.resolveSyntaxNode(node.cond);
    this.resolveSyntaxNode(node.thenBranch);
    if (node.elseBranch !== null) {
      this.resolveSyntaxNode(node.elseBranch)
    }
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): void {
    this.resolveSyntaxNode(node.cond);
    this.resolveSyntaxNode(node.loopBody);
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): void {
    this.resolveSyntaxNode(node.left);
    this.resolveSyntaxNode(node.right);
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): void {
    const variableName = node.identifier.lexeme;
    const existingVariableStatusInStack = this.scope.getVariableStatusFromStack(variableName);
    if (existingVariableStatusInStack === null) {
      this.generateResolverError(node, `Undeclared variable cannot be substituted`);
    }
    else if (existingVariableStatusInStack === VariableStatus.DECLARED) {
      this.generateResolverError(node, `Uninitialized variable cannot be substituted`);
    }
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): void {
    if (node.rvalue !== null) {
      this.resolveSyntaxNode(node.rvalue);
    }
    const isDeclaration = node.modifier !== null;
    const variableName = node.identifier.lexeme;
    const existingVariableStatusInStack = this.scope.getVariableStatusFromStack(variableName);
    if (isDeclaration) {
      if (existingVariableStatusInStack !== null) {
        this.generateResolverError(node, `Variable/parameter shadowing is not allowed`);
      }
      this.scope.declareVariable(variableName);
    }
    else {
      if (existingVariableStatusInStack === null) {
        this.generateResolverError(node, `Undeclared variable cannot be assigned to`);
      }
    }
    if (node.rvalue !== null) {
      this.scope.initializeVariable(variableName);
    }
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): void {
    for (const parameter of node.parameterList) {
      const parameterName = parameter.lexeme;
      if (this.scope.getVariableStatusFromStack(parameterName) !== null) {
        this.generateResolverError(node, `Variable/parameter shadowing is not allowed`);
      }
    }
    this.beginScope(node.parameterList.map((token) => token.lexeme));
    this.resolveList(node.statementList);
    this.endScope();
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): void {
    this.resolveSyntaxNode(node.callee);
    for (const argument of node.argumentList) {
      this.resolveSyntaxNode(argument);
    }
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): void {
    if (node.retvalExpr) {
      this.resolveSyntaxNode(node.retvalExpr);
    }
  }
}
