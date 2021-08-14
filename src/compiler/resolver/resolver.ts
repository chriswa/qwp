import { BinarySyntaxNode, FunctionCallSyntaxNode, FunctionDefinitionSyntaxNode, GroupingSyntaxNode, IfStatementSyntaxNode, LiteralSyntaxNode, LogicShortCircuitSyntaxNode, ReturnStatementSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, TypeDeclarationSyntaxNode, UnarySyntaxNode, VariableAssignmentSyntaxNode, VariableLookupSyntaxNode, WhileStatementSyntaxNode } from "../syntax/syntax"
import { builtinsByName } from "../../builtins/builtins"
import { ErrorWithSourcePos } from "../../ErrorWithSourcePos"
import { TokenType } from "../Token"
import { parse } from "../parser/parser"
import { CompileError } from "../CompileError"
import { ResolverOutput } from "./resolverOutput"

interface IResolverResponse {
  ast: SyntaxNode;
  resolverOutput: ResolverOutput;
}

export function resolve(source: string, path: string): IResolverResponse {
  const ast = parse(source, path);
  const resolver = new Resolver();
  const resolverErrors = resolver.resolve(ast);
  if (resolverErrors.length > 0) {
    throw new CompileError(resolverErrors);
  }
  const resolverOutput = new ResolverOutput(resolver.closedVarsByFunctionNode, resolver.scopesByNode);
  return { ast, resolverOutput };
}

export class VariableDefinition {
  public isClosed = false;
  public isRef = false;
  constructor(
    public isBuiltInOrParameter: boolean,
    public isReadOnly: boolean,
  ) { }
}

export class ResolverScope {
  public variableDefinitions: Map<string, VariableDefinition> = new Map();
  public initializedVars: Set<string> = new Set();
  public closedVars: Array<string> = []; // only used if this.isFunction === true
  public constructor(
    private isFunction: boolean,
    public parentScope: ResolverScope | null = null,
    preinitializedIdentifiers: Array<string>,
  ) {
    for (const identifier of preinitializedIdentifiers) {
      const variableStatus = new VariableDefinition(true, true);
      this.initializedVars.add(identifier);
      this.variableDefinitions.set(identifier, variableStatus);
    }
  }
  public getVariableDefinitionFromStack(identifier: string): VariableDefinition | null {
    const localVarDef = this.variableDefinitions.get(identifier);
    if (localVarDef !== undefined) {
      return localVarDef;
    }
    if (this.parentScope !== null) {
      const ancestorVarDef = this.parentScope.getVariableDefinitionFromStack(identifier);
      if (ancestorVarDef !== null && this.isFunction) {
        ancestorVarDef.isClosed = true;
        ancestorVarDef.isRef = true;
        this.closedVars.push(identifier);
        const newVarDef = new VariableDefinition(true, ancestorVarDef.isReadOnly);
        newVarDef.isRef = true;
        this.initializedVars.add(identifier); // necessary?
        this.variableDefinitions.set(identifier, newVarDef);
      }
      return ancestorVarDef;
    }
    return null;
  }
  public declareVariable(identifier: string, isReadOnly: boolean): VariableDefinition {
    const variableStatus = new VariableDefinition(false, isReadOnly);
    this.variableDefinitions.set(identifier, variableStatus);
    return variableStatus;
  }
  public assignVariable(identifier: string) {
    this.initializedVars.add(identifier);
  }
  public isVarInitialized(identifier: string): boolean {
    if (this.initializedVars.has(identifier)) {
      return true;
    }
    else {
      if (this.parentScope !== null) {
        return this.parentScope.isVarInitialized(identifier);
      }
      else {
        return false;
      }
    }
  }
}

class Resolver implements SyntaxNodeVisitor<void> {
  scope: ResolverScope;
  scopesByNode: Map<SyntaxNode, ResolverScope> = new Map();
  closedVarsByFunctionNode: Map<SyntaxNode, Array<string>> = new Map(); // map from FunctionDeclarationSyntaxNode to list of closed identifiers
  resolverErrors: Array<ErrorWithSourcePos> = [];
  constructor() {
    this.scope = new ResolverScope(false, null, Array.from(builtinsByName.keys()));
  }
  beginScope(isFunction: boolean, node: SyntaxNode, preinitializedIdentifiers: Array<string>) {
    this.scope = new ResolverScope(isFunction, this.scope, preinitializedIdentifiers);
    this.scopesByNode.set(node, this.scope);
  }
  endScope() {
    if (this.scope.parentScope === null) {
      throw new Error("internal logic error: attempted to leave global scope");
    }
    this.scope = this.scope.parentScope;
  }

  generateResolverError(node: SyntaxNode, message: string) {
    const resolverError = new ErrorWithSourcePos("Resolver: " + message, node.referenceToken.path, node.referenceToken.charPos);
    this.resolverErrors.push(resolverError);
    return resolverError;
  }


  resolve(node: SyntaxNode): Array<ErrorWithSourcePos> {
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
  visitBinary(node: BinarySyntaxNode) {
    this.resolveSyntaxNode(node.left);
    this.resolveSyntaxNode(node.right);
  }
  visitUnary(node: UnarySyntaxNode) {
    this.resolveSyntaxNode(node.right);
  }
  visitLiteral(node: LiteralSyntaxNode) {
    // pass
  }
  visitGrouping(node: GroupingSyntaxNode) {
    this.resolveSyntaxNode(node.expr);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode) {
    this.beginScope(false, node, []);
    this.resolveList(node.statementList);
    this.endScope();
  }
  visitIfStatement(node: IfStatementSyntaxNode) {
    this.resolveSyntaxNode(node.cond);
    this.resolveSyntaxNode(node.thenBranch);
    if (node.elseBranch !== null) {
      this.resolveSyntaxNode(node.elseBranch);
    }

    // late-const branch initialization feature
    const thenInitializedVars = this.scopesByNode.get(node.thenBranch)!.initializedVars;
    const elseInitializedVars: Set<string> = node.elseBranch !== null ? this.scopesByNode.get(node.elseBranch)!.initializedVars : new Set();
    const bothInitializedVars = new Set([...thenInitializedVars, ...elseInitializedVars]);
    const xorInitializedVars = new Set([
      ...[...thenInitializedVars].filter(x => !elseInitializedVars.has(x)),
      ...[...elseInitializedVars].filter(x => !thenInitializedVars.has(x)),
    ]);
    bothInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.getVariableDefinitionFromStack(identifier);
      if (parentVarStatus !== null) {
        this.scope.assignVariable(identifier);
      }
    });
    xorInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.getVariableDefinitionFromStack(identifier);
      if (parentVarStatus !== null && parentVarStatus.isReadOnly) {
        this.generateResolverError(node, `Late const assignment of variable "${identifier}" must occur in all branches`);
      }
    });
  }
  visitWhileStatement(node: WhileStatementSyntaxNode) {
    this.resolveSyntaxNode(node.cond);
    this.resolveSyntaxNode(node.loopBody);
    const loopInitializedVars = this.scopesByNode.get(node.loopBody)!.initializedVars;
    loopInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.getVariableDefinitionFromStack(identifier);
      if (parentVarStatus !== null && parentVarStatus.isReadOnly) {
        this.generateResolverError(node, `Late const assignment of variable "${identifier}" may not occur in a loop`);
      }
    });
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode) {
    this.resolveSyntaxNode(node.left);
    this.resolveSyntaxNode(node.right);
  }
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode) {
    // TODO: write a type system
  }
  visitVariableLookup(node: VariableLookupSyntaxNode) {
    const identifier = node.identifier.lexeme;
    const existingVariableStatusInStack = this.scope.getVariableDefinitionFromStack(identifier);
    if (existingVariableStatusInStack === null) {
      this.generateResolverError(node, `Undeclared variable "${identifier}" cannot be substituted`);
    }
    else {
      if (!this.scope.isVarInitialized(identifier)) {
        this.generateResolverError(node, `Uninitialized variable "${identifier}" cannot be substituted`)
      }
    }
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode) {
    if (node.rvalue !== null) {
      this.resolveSyntaxNode(node.rvalue);
    }
    const declarationModifier = node.modifier;
    const identifier = node.identifier.lexeme;
    let existingVariableStatusInStack = this.scope.getVariableDefinitionFromStack(identifier);
    if (declarationModifier !== null) {
      if (existingVariableStatusInStack !== null) {
        this.generateResolverError(node, `Variable/parameter shadowing is not allowed`);
        return;
      }
      existingVariableStatusInStack = this.scope.declareVariable(identifier, declarationModifier.type === TokenType.KEYWORD_CONST);
    }
    else {
      if (existingVariableStatusInStack === null) {
        this.generateResolverError(node, `Undeclared variable cannot be assigned to`);
        return;
      }
    }
    if (node.rvalue !== null) {
      if (this.scope.isVarInitialized(identifier) && existingVariableStatusInStack.isReadOnly) {
        this.generateResolverError(node, `Constant variable cannot be re-assigned to`);
        return;
      }
      this.scope.assignVariable(identifier);
    }
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode) {
    for (const parameter of node.parameterList) {
      const parameterName = parameter.lexeme;
      if (this.scope.getVariableDefinitionFromStack(parameterName) !== null) {
        this.generateResolverError(node, `Variable/parameter shadowing is not allowed`);
      }
    }
    this.beginScope(true, node, node.parameterList.map((token) => token.lexeme));
    this.resolveList(node.statementList);

    this.closedVarsByFunctionNode.set(node, this.scope.closedVars);

    this.endScope();
  }
  visitFunctionCall(node: FunctionCallSyntaxNode) {
    this.resolveSyntaxNode(node.callee);
    for (const argument of node.argumentList) {
      this.resolveSyntaxNode(argument);
    }
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode) {
    if (node.retvalExpr) {
      this.resolveSyntaxNode(node.retvalExpr);
    }
  }
}
