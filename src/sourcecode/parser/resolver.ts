import { BinarySyntaxNode, FunctionCallSyntaxNode, FunctionDefinitionSyntaxNode, GroupingSyntaxNode, IfStatementSyntaxNode, LiteralSyntaxNode, LogicShortCircuitSyntaxNode, ReturnStatementSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, UnarySyntaxNode, VariableAssignmentSyntaxNode, VariableLookupSyntaxNode, WhileStatementSyntaxNode } from "../syntax/syntax"
import { INTERPRETER_BUILTINS } from "../../interpreter/builtins"
import { SyntaxError } from "./SyntaxError"
import { TokenType } from "./Token"

enum VariableStatusEnum {
  BUILTIN_OR_PARAMETER,
  DECLARED,
  INITIALIZED,
};

class VariableStatus {
  constructor(
    public isBuiltInOrParameter: boolean,
    public isInitialized: boolean,
    public isReadOnly: boolean,
  ) { }
}


class ResolverScope {
  private table: Record<string, VariableStatus> = {};
  public constructor(
    public parentScope: ResolverScope | null = null,
    preinitializedIdentifiers: Array<string>,
  ) {
    for (const identifier of preinitializedIdentifiers) {
      const variableStatus = new VariableStatus(true, true, true);
      variableStatus.isBuiltInOrParameter = true;
      this.table[identifier] = variableStatus;
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
  public declareVariable(identifier: string, isReadOnly: boolean): VariableStatus {
    const variableStatus = new VariableStatus(false, false, isReadOnly);
    this.table[identifier] = variableStatus;
    return variableStatus;
  }
  public assignVariable(identifier: string) {
    const existingVariableInStack = this.getVariableStatusFromStack(identifier);
    if (existingVariableInStack === null) { throw new Error("logic error in resolver"); }
    if (existingVariableInStack.isBuiltInOrParameter) { throw new Error("logic error in resolver"); }
    this.table[identifier] = new VariableStatus(false, true, existingVariableInStack.isReadOnly);
  }
  public getInitializedVariables(): Set<string> {
    return new Set(Object.keys(this.table).filter(id => this.table[id].isInitialized));
  }
}

export class Resolver implements SyntaxNodeVisitor<ResolverScope | null> {
  scope: ResolverScope;
  resolverErrors: Array<SyntaxError> = [];
  constructor() {
    this.scope = new ResolverScope(null, Object.keys(INTERPRETER_BUILTINS));
  }
  beginScope(preinitializedIdentifiers: Array<string>) {
    this.scope = new ResolverScope(this.scope, preinitializedIdentifiers);
  }
  endScope(): ResolverScope {
    if (this.scope.parentScope === null) {
      throw new Error("internal logic error: attempted to leave global scope");
    }
    const closedScope = this.scope;
    this.scope = this.scope.parentScope;
    return closedScope;
  }

  generateResolverError(node: SyntaxNode, message: string) {
    const resolverError = new SyntaxError("Resolver: " + message, node.referenceToken.path, node.referenceToken.charPos);
    this.resolverErrors.push(resolverError);
    return resolverError;
  }


  resolve(node: SyntaxNode): Array<SyntaxError> {
    this.resolverErrors = [];
    this.resolveSyntaxNode(node);
    return this.resolverErrors;
  }

  resolveSyntaxNode(node: SyntaxNode): ResolverScope | null {
    return node.accept(this);
  }
  resolveList(nodeList: Array<SyntaxNode>) {
    for (const node of nodeList) {
      this.resolveSyntaxNode(node);
    }
  }
  visitBinary(node: BinarySyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.left);
    this.resolveSyntaxNode(node.right);
    return null;
  }
  visitUnary(node: UnarySyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.right);
    return null;
  }
  visitLiteral(node: LiteralSyntaxNode): ResolverScope | null {
    // pass
    return null;
  }
  visitGrouping(node: GroupingSyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.expr);
    return null;
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): ResolverScope | null {
    this.beginScope([]);
    // hoist declarations
    // for (const statement of node.statementList) {
    //   if (statement instanceof VariableAssignmentSyntaxNode && statement.modifier !== null) {
    //     this.declareVariable(statement.identifier);
    //   }
    // }
    // recurse resolution
    this.resolveList(node.statementList);
    return this.endScope();
  }
  visitIfStatement(node: IfStatementSyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.cond);
    const thenScope = this.resolveSyntaxNode(node.thenBranch);
    let elseScope: ResolverScope | null = null;
    if (node.elseBranch !== null) {
      elseScope = this.resolveSyntaxNode(node.elseBranch)
    }
    // branch initialization feature!
    if (thenScope !== null && elseScope !== null) {
      const thenInitializedVars = thenScope.getInitializedVariables();
      const elseInitializedVars = elseScope.getInitializedVariables();
      const bothInitializedVars = new Set([...thenInitializedVars].filter(x => elseInitializedVars.has(x))); // intersection
      const xorInitializedVars = new Set([...thenInitializedVars].filter(x => !elseInitializedVars.has(x)));
      bothInitializedVars.forEach((identifier) => {
        const parentVarStatus = this.scope.getVariableStatusFromStack(identifier);
        if (parentVarStatus !== null) {
          this.scope.assignVariable(identifier);
        }
      });
      xorInitializedVars.forEach((identifier) => {
        const parentVarStatus = this.scope.getVariableStatusFromStack(identifier);
        if (parentVarStatus !== null && parentVarStatus.isReadOnly) {
          this.generateResolverError(node, `Late const assignment of variable "${identifier}" must occur in all branches`);
        }
      });
    }
    return null;
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.cond);
    const loopScope = this.resolveSyntaxNode(node.loopBody);
    if (loopScope !== null) {
      const loopInitializedVars = loopScope.getInitializedVariables();
      loopInitializedVars.forEach((identifier) => {
        const parentVarStatus = this.scope.getVariableStatusFromStack(identifier);
        if (parentVarStatus !== null && parentVarStatus.isReadOnly) {
          this.generateResolverError(node, `Late const assignment of variable "${identifier}" may not occur in a loop`);
        }
      });
    }
    return null;
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.left);
    this.resolveSyntaxNode(node.right);
    return null;
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): ResolverScope | null {
    const variableName = node.identifier.lexeme;
    const existingVariableStatusInStack = this.scope.getVariableStatusFromStack(variableName);
    if (existingVariableStatusInStack === null) {
      this.generateResolverError(node, `Undeclared variable cannot be substituted`);
    }
    else if (!existingVariableStatusInStack.isInitialized) {
      this.generateResolverError(node, `Uninitialized variable cannot be substituted`);
    }
    return null;
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): ResolverScope | null {
    if (node.rvalue !== null) {
      this.resolveSyntaxNode(node.rvalue);
    }
    const declarationModifier = node.modifier;
    const variableName = node.identifier.lexeme;
    let existingVariableStatusInStack = this.scope.getVariableStatusFromStack(variableName);
    if (declarationModifier !== null) {
      if (existingVariableStatusInStack !== null) {
        this.generateResolverError(node, `Variable/parameter shadowing is not allowed`);
      }
      existingVariableStatusInStack = this.scope.declareVariable(variableName, declarationModifier.type === TokenType.KEYWORD_CONST);
    }
    else {
      if (existingVariableStatusInStack === null) {
        this.generateResolverError(node, `Undeclared variable cannot be assigned to`);
      }
    }
    if (node.rvalue !== null) {
      if (existingVariableStatusInStack?.isInitialized && existingVariableStatusInStack.isReadOnly) {
        this.generateResolverError(node, `Constant variable cannot be re-assigned to`);
      }
      this.scope.assignVariable(variableName);
    }
    return null;
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): ResolverScope | null {
    for (const parameter of node.parameterList) {
      const parameterName = parameter.lexeme;
      if (this.scope.getVariableStatusFromStack(parameterName) !== null) {
        this.generateResolverError(node, `Variable/parameter shadowing is not allowed`);
      }
    }
    this.beginScope(node.parameterList.map((token) => token.lexeme));
    this.resolveList(node.statementList);
    this.endScope();
    return null;
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.callee);
    for (const argument of node.argumentList) {
      this.resolveSyntaxNode(argument);
    }
    return null;
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): ResolverScope | null {
    if (node.retvalExpr) {
      this.resolveSyntaxNode(node.retvalExpr);
    }
    return null;
  }
}
