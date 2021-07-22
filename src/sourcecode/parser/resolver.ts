import { BinarySyntaxNode, FunctionCallSyntaxNode, FunctionDefinitionSyntaxNode, GroupingSyntaxNode, IfStatementSyntaxNode, LiteralSyntaxNode, LogicShortCircuitSyntaxNode, ReturnStatementSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, UnarySyntaxNode, VariableAssignmentSyntaxNode, VariableLookupSyntaxNode, WhileStatementSyntaxNode } from "../syntax/syntax"
import { builtinsByName } from "../../builtins/builtins"
import { SyntaxError } from "./SyntaxError"
import { TokenType } from "./Token"

interface ISyntaxErrorResolverResponse {
  kind: "SYNTAX_ERROR";
  syntaxErrors: Array<SyntaxError>;
}
interface ISuccessResolverResponse {
  kind: "SUCCESS";
  resolverOutput: ResolverOutput;
}
type ResolverResponse = ISyntaxErrorResolverResponse | ISuccessResolverResponse;

export class ResolverOutput {
  public varDeclarationsByBlockOrFunctionNode: Map<SyntaxNode, ResolverScopeOutput>;
  constructor(
    public closedVarsByFunctionNode: Map<SyntaxNode, Array<string>>, // map from FunctionDefinitionSyntaxNode to set of identifiers
    varsByScope: Map<SyntaxNode, ResolverScope>,
  ) {
    this.varDeclarationsByBlockOrFunctionNode = new Map()
    varsByScope.forEach((resolverScope, syntaxNode) => {
      const resolverScopeOutput = new ResolverScopeOutput(resolverScope);
      // console.log(`syntaxNode =>`)
      // console.dir(syntaxNode)
      // console.log(`resolverScopeOutput =>`)
      // console.dir(resolverScopeOutput)
      this.varDeclarationsByBlockOrFunctionNode.set(syntaxNode, resolverScopeOutput);
    });
  }
}

export class ResolverScopeOutput {
  public table: Record<string, ResolverVariableDetails> = {};
  public constructor(resolverScope: ResolverScope) {
    for (const identifier in resolverScope.table) {
      const varStatus = resolverScope.table[identifier];
      if (varStatus.isDeclaredHere) { // only include declarations
        this.table[identifier] = new ResolverVariableDetails(varStatus);
      }
    }
  }
}

export class ResolverVariableDetails {
  public isClosed: boolean;
  public isRef: boolean;
  public constructor(
    varStatus: VariableStatus,
  ) {
    this.isClosed = varStatus.isClosed;
    this.isRef = varStatus.isRef;
  }
  public toString() {
    return `${this.isRef ? 'isRef' : ''}, ${this.isClosed ? 'isClosed' : ''}`;
  }
}

export function resolve(ast: SyntaxNode): ResolverResponse {
  const resolver = new Resolver();
  const resolverErrors = resolver.resolve(ast);
  if (resolverErrors.length > 0) {
    return { kind: "SYNTAX_ERROR", syntaxErrors: resolverErrors }
  }
  const resolverOutput = new ResolverOutput(resolver.closedVarsByFunctionNode, resolver.varsByScope);
  return { kind: "SUCCESS", resolverOutput };
}

class VariableStatus {
  public isClosed = false;
  public isRef = false;
  constructor(
    public isDeclaredHere: boolean,
    public isBuiltInOrParameter: boolean,
    public isInitialized: boolean,
    public isReadOnly: boolean,
  ) { }
}

export class ResolverScope {
  public table: Record<string, VariableStatus> = {};
  public closedVars: Array<string> = []; // only used if !!this.isFunction
  public constructor(
    private isFunction: boolean,
    public parentScope: ResolverScope | null = null,
    preinitializedIdentifiers: Array<string>,
  ) {
    for (const identifier of preinitializedIdentifiers) {
      const variableStatus = new VariableStatus(true, true, true, true);
      variableStatus.isBuiltInOrParameter = true;
      this.table[identifier] = variableStatus;
    }
  }
  public getVariableStatusFromStack(identifier: string, isClosed = false): VariableStatus | null {
    if (identifier in this.table) {
      const varStatus = this.table[identifier];
      if (varStatus.isDeclaredHere) {
        if (isClosed) {
          varStatus.isClosed = true;
          varStatus.isRef = true;
        }
        return this.table[identifier]
      }
    }
    if (this.parentScope !== null) {
      const variableStatus = this.parentScope.getVariableStatusFromStack(identifier, isClosed || this.isFunction);
      if (variableStatus !== null && this.isFunction) {
        this.closedVars.push(identifier);
        this.table[identifier] = new VariableStatus(true, true, true, variableStatus.isReadOnly);
        this.table[identifier].isRef = true;
      }
      return variableStatus;
    }
    return null;
  }
  public declareVariable(identifier: string, isReadOnly: boolean): VariableStatus {
    const variableStatus = new VariableStatus(true, false, false, isReadOnly);
    this.table[identifier] = variableStatus;
    return variableStatus;
  }
  public assignVariable(identifier: string) {
    const existingVariableInStack = this.getVariableStatusFromStack(identifier);
    if (existingVariableInStack === null) { throw new Error("logic error in resolver"); }
    if (existingVariableInStack.isBuiltInOrParameter) { throw new Error("logic error in resolver") }
    const isDeclaredHere = existingVariableInStack.isDeclaredHere && existingVariableInStack === this.table[identifier];
    this.table[identifier] = new VariableStatus(isDeclaredHere, false, true, existingVariableInStack.isReadOnly);
  }
  public getInitializedVariables(): Set<string> {
    return new Set(Object.keys(this.table).filter(id => this.table[id].isInitialized));
  }
}

class Resolver implements SyntaxNodeVisitor<ResolverScope | null> {
  scope: ResolverScope;
  varsByScope: Map<SyntaxNode, ResolverScope> = new Map();
  closedVarsByFunctionNode: Map<SyntaxNode, Array<string>> = new Map(); // map from FunctionDeclarationSyntaxNode to list of closed identifiers
  resolverErrors: Array<SyntaxError> = [];
  constructor() {
    this.scope = new ResolverScope(false, null, Array.from(builtinsByName.keys()));
  }
  beginScope(isFunction: boolean, node: SyntaxNode, preinitializedIdentifiers: Array<string>) {
    this.scope = new ResolverScope(isFunction, this.scope, preinitializedIdentifiers);
    this.varsByScope.set(node, this.scope);
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
    return null;
  }
  visitGrouping(node: GroupingSyntaxNode): ResolverScope | null {
    this.resolveSyntaxNode(node.expr);
    return null;
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): ResolverScope | null {
    this.beginScope(false, node, []);
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
        return null;
      }
      existingVariableStatusInStack = this.scope.declareVariable(variableName, declarationModifier.type === TokenType.KEYWORD_CONST);
    }
    else {
      if (existingVariableStatusInStack === null) {
        this.generateResolverError(node, `Undeclared variable cannot be assigned to`);
        return null;
      }
    }
    if (node.rvalue !== null) {
      if (existingVariableStatusInStack?.isInitialized && existingVariableStatusInStack.isReadOnly) {
        this.generateResolverError(node, `Constant variable cannot be re-assigned to`);
        return null;
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
    this.beginScope(true, node, node.parameterList.map((token) => token.lexeme));
    this.resolveList(node.statementList);

    this.closedVarsByFunctionNode.set(node, this.scope.closedVars);

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
