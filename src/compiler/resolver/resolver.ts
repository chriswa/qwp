import { ClassDeclarationSyntaxNode, FunctionCallSyntaxNode, FunctionDefinitionSyntaxNode, MemberLookupSyntaxNode, GroupingSyntaxNode, IfStatementSyntaxNode, LiteralSyntaxNode, LogicShortCircuitSyntaxNode, MemberAssignmentSyntaxNode, ObjectInstantiationSyntaxNode, ReturnStatementSyntaxNode, StatementBlockSyntaxNode, SyntaxNode, SyntaxNodeVisitor, TypeDeclarationSyntaxNode, VariableAssignmentSyntaxNode, VariableLookupSyntaxNode, WhileStatementSyntaxNode } from "../syntax/syntax"
import { ErrorWithSourcePos } from "../../ErrorWithSourcePos"
import { TokenType } from "../Token"
import { parse } from "../parser/parser"
import { CompileError } from "../CompileError"
import { FunctionParameter } from "../syntax/FunctionParameter"
import { mapMap, throwExpr } from "../../util"
import { IResolverScopeOutput, ResolverScope } from "./ResolverScope"
import { ValueType } from "../syntax/ValueType"
import { ClassType, FunctionType, primitiveTypes, primitiveTypesMap, ReadOnlyStatus, TypeWrapper, UnresolvedAnnotatedType } from "../../types/types"
import { builtinsTypeWrappersByName } from "../../builtins/builtins"
import { InferenceEngine } from "../../types/InferenceEngine"
import { TypeAnnotation } from "../syntax/TypeAnnotation"

export interface IResolverOutput {
  scopesByNode: Map<SyntaxNode, IResolverScopeOutput>,
  classNodesByClassTypeWrapper: Map<TypeWrapper, ClassDeclarationSyntaxNode>,
}

interface IResolverResponse {
  ast: SyntaxNode;
  resolverOutput: IResolverOutput;
}

export function resolve(source: string, path: string): IResolverResponse {
  const ast = parse(source, path);
  const resolver = new Resolver();
  const resolverErrors = resolver.resolve(ast);
  if (resolverErrors.length > 0) {
    throw new CompileError(resolverErrors);
  }
  const resolverOutput = resolver as IResolverOutput;
  return { ast, resolverOutput };
}

export class Resolver implements SyntaxNodeVisitor<TypeWrapper>, IResolverOutput {
  scope: ResolverScope;
  scopesByNode: Map<SyntaxNode, ResolverScope> = new Map();
  classNodesByClassTypeWrapper: Map<TypeWrapper, ClassDeclarationSyntaxNode> = new Map();
  inferenceEngine: InferenceEngine = new InferenceEngine();
  resolverErrors: Array<ErrorWithSourcePos> = [];
  constructor() {
    const topScope = new ResolverScope(this, null, false, null);
    builtinsTypeWrappersByName.forEach((typeWrapper, builtinName) => {
      topScope.initializeVariable(builtinName, typeWrapper, ReadOnlyStatus.ReadOnly);
    });
    primitiveTypesMap.forEach((type, typeName) => {
      topScope.typeWrappers.set(typeName, new TypeWrapper(`primitiveType(${typeName})`, type));
    });
    this.scope = topScope;
  }
  beginScope(isFunction: boolean, node: SyntaxNode) {
    const newScope = new ResolverScope(this, node, isFunction, this.scope);
    this.scopesByNode.set(node, newScope);
    this.scope = newScope;
  }
  initializeFunctionParameters(node: SyntaxNode, functionParameters: Array<FunctionParameter>): Array<TypeWrapper> {
    return functionParameters.map((functionParameter) => {
      const parameterName = functionParameter.identifier.lexeme;
      this.disallowShadowing(parameterName, node);
      const parameterTypeWrapper = new TypeWrapper(node, primitiveTypes.any);
      this.inferenceEngine.applyAnnotationConstraint(parameterTypeWrapper, this.scope, functionParameter.typeAnnotation);
      this.scope.initializeVariable(parameterName, parameterTypeWrapper, ReadOnlyStatus.ReadOnly);
      return parameterTypeWrapper;
    });

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
    if (this.resolverErrors.length > 0) {
      return this.resolverErrors;
    }
    this.inferenceEngine.solve();
    return this.resolverErrors;
  }

  resolveSyntaxNode(node: SyntaxNode): TypeWrapper {
    return node.accept(this);
  }
  resolveList(nodeList: Array<SyntaxNode>) {
    for (const node of nodeList) {
      this.resolveSyntaxNode(node);
    }
  }
  visitLiteral(node: LiteralSyntaxNode): TypeWrapper {
    if (node.type === ValueType.BOOLEAN) {
      return new TypeWrapper(node, primitiveTypes.bool32);
    }
    else if (node.type === ValueType.NUMBER) {
      return new TypeWrapper(node, primitiveTypes.float32);
    }
    else {
      throw new Error(`TODO: other literal types`);
    }
  }
  visitGrouping(node: GroupingSyntaxNode): TypeWrapper {
    return this.resolveSyntaxNode(node.expr);
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): TypeWrapper {
    this.beginScope(false, node);
    this.resolveList(node.statementList);
    this.endScope();
    return new TypeWrapper(node, primitiveTypes.never);
  }
  visitIfStatement(node: IfStatementSyntaxNode): TypeWrapper {
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
      const parentVarStatus = this.scope.lookupVariableAndWireUpClosures(identifier);
      if (parentVarStatus !== null) {
        this.scope.assignVariable(identifier);
      }
    });
    xorInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.lookupVariableAndWireUpClosures(identifier);
      if (parentVarStatus !== null && parentVarStatus.isReadOnly()) {
        throw new Error(`Late const assignment of variable "${identifier}" must occur in all branches`);
      }
    });
    return new TypeWrapper(node, primitiveTypes.never);
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): TypeWrapper {
    this.resolveSyntaxNode(node.cond);
    this.resolveSyntaxNode(node.loopBody);
    const loopInitializedVars = this.scopesByNode.get(node.loopBody)!.initializedVars;
    loopInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.lookupVariableAndWireUpClosures(identifier);
      if (parentVarStatus !== null && parentVarStatus.isReadOnly()) {
        throw new Error(`Late const assignment of variable "${identifier}" may not occur in a loop`);
      }
    });
    return new TypeWrapper(node, primitiveTypes.never);
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): TypeWrapper {
    const leftTypeWrapper = this.resolveSyntaxNode(node.left);
    const rightTypeWrapper = this.resolveSyntaxNode(node.right);
    return this.inferenceEngine.addCoercion(node, [leftTypeWrapper, rightTypeWrapper]);
  }
  disallowShadowing(identifier: string, referenceNode: SyntaxNode) {
    if (this.scope.lookupVariableAndWireUpClosures(identifier) !== null) {
      this.generateResolverError(referenceNode, `Variable/parameter/field shadowing is not allowed`);
    }
  }
  visitClassDeclaration(node: ClassDeclarationSyntaxNode): TypeWrapper {
    const className = node.newClassName.lexeme;
    let baseClassTypeWrapper: TypeWrapper | null = null;
    if (node.baseClassName !== null) {
      baseClassTypeWrapper = this.scope.lookupTypeWrapper(node.baseClassName.lexeme) ?? throwExpr(new Error(`failed to lookup base class`));
    }
    const interfaceTypeWrappers: Array<TypeWrapper> = [];
    node.implementedInterfaceNames.forEach(interfaceNameToken => {
      const interfaceTypeWrapper = this.scope.lookupTypeWrapper(interfaceNameToken.lexeme) ?? throwExpr(new Error(`failed to lookup interface`));
      interfaceTypeWrappers.push(interfaceTypeWrapper);
    });

    const classTypeWrapper = new TypeWrapper(node, new UnresolvedAnnotatedType(this.scope, new TypeAnnotation(node.newClassName, undefined)));

    const fields: Map<string, TypeWrapper> = new Map();
    node.fields.forEach((typeAnnotation, fieldName) => {
      this.disallowShadowing(fieldName, node);
      const fieldTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(classTypeWrapper, fieldName);
      this.inferenceEngine.applyAnnotationConstraint(fieldTypeWrapper, this.scope, typeAnnotation);
      fields.set(fieldName, fieldTypeWrapper);
    });
    const methods: Map<string, TypeWrapper> = new Map();
    node.methods.forEach((typeAnnotation, methodName) => {
      this.disallowShadowing(methodName, node);
      const methodTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(classTypeWrapper, methodName);
      methods.set(methodName, methodTypeWrapper);
    });
    const classType = new ClassType(
      this.scope, // resolverScope
      node.referenceToken, // referenceToken
      className, // name
      node.genericDefinition, // genericDefinition
      baseClassTypeWrapper, // baseClassType
      interfaceTypeWrappers, // interfaceTypes
      fields, // fields
      methods, // methods
    );
    classTypeWrapper.type = classType;
    this.scope.declareType(classType.name, classTypeWrapper);

    // traverse methods
    this.beginScope(false, node); // field scope
    const classScope = this.scope;
    classType.fields.forEach((typeWrapper, fieldName) => {
      this.scope.initializeVariable(fieldName, typeWrapper, ReadOnlyStatus.Mutable);
    });
    this.scope.initializeVariable('this', classTypeWrapper, ReadOnlyStatus.ReadOnly);
    node.methods.forEach((methodNode, methodName) => {
      this.beginScope(true, methodNode);
      const parameterTypeWrappers = this.initializeFunctionParameters(methodNode, methodNode.parameterList);
      this.resolveList(methodNode.statementList);
      const observedReturnTypeWrappers = this.scope.getObservedReturnTypeWrappers();
      const inferredReturnTypeWrapper = this.inferenceEngine.addCoercion(methodNode, observedReturnTypeWrappers);
      this.endScope();

      const methodTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(classTypeWrapper, methodName);
      this.inferenceEngine.applyFunctionConstraints(methodTypeWrapper, this.scope, methodNode.parameterList.map(fp => fp.typeAnnotation), methodNode.returnTypeAnnotation, inferredReturnTypeWrapper);
    });
    this.endScope();

    this.classNodesByClassTypeWrapper.set(classTypeWrapper, node);
    this.scopesByNode.set(node, classScope) // unnecessary?

    return new TypeWrapper(node, primitiveTypes.never);
  }
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode): TypeWrapper {
    const typeWrapper = new TypeWrapper(node, primitiveTypes.any);
    this.inferenceEngine.applyAnnotationConstraint(typeWrapper, this.scope, node.typeAnnotation);
    this.scope.declareType(node.identifier.lexeme, typeWrapper);
    return new TypeWrapper(node, primitiveTypes.never);
  }
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): TypeWrapper {
    const classType = this.scope.lookupTypeWrapper(node.className.lexeme) ?? throwExpr(new Error(`could not find class referenced by "new"`));
    for (const argument of node.constructorArgumentList) {
      const argumentTypeWrapper = this.resolveSyntaxNode(argument);
      // TODO: verify types of arguments match classType's constructor's parameter types
    }
    return classType;
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): TypeWrapper {
    const identifier = node.identifier.lexeme;
    const existingVariableStatusInStack = this.scope.lookupVariableAndWireUpClosures(identifier);
    if (existingVariableStatusInStack === null) {
      throw new Error(`Undeclared variable "${identifier}" cannot be substituted`)
    }
    else {
      if (!this.scope.isVariableInitialized(identifier)) {
        throw new Error(`Uninitialized variable "${identifier}" cannot be substituted`)
      }
    }
    return existingVariableStatusInStack.typeWrapper;
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): TypeWrapper {
    const declarationModifier = node.modifier;
    const identifier = node.identifier.lexeme;
    let existingVariableStatusInStack = this.scope.lookupVariableAndWireUpClosures(identifier);
    if (declarationModifier !== null) {
      if (existingVariableStatusInStack !== null) {
        throw new Error(`Variable/parameter/field shadowing is not allowed`);
      }
      const typeWrapper = new TypeWrapper(node, primitiveTypes.any);
      this.inferenceEngine.applyAnnotationConstraint(typeWrapper, this.scope, node.typeAnnotation);
      const readOnlyStatus = declarationModifier.type === TokenType.KEYWORD_CONST ? ReadOnlyStatus.ReadOnly : ReadOnlyStatus.Mutable;
      existingVariableStatusInStack = this.scope.declareVariable(identifier, typeWrapper, readOnlyStatus);
    }
    else {
      if (existingVariableStatusInStack === null) {
        throw new Error(`Undeclared variable cannot be assigned to`);
      }
    }
    if (node.rvalue !== null) {
      if (this.scope.isVariableInitialized(identifier) && existingVariableStatusInStack.isReadOnly()) {
        throw new Error(`Constant variable cannot be re-assigned to`);
      }
      this.scope.assignVariable(identifier);
      let rvalueTypeWrapper: TypeWrapper = this.resolveSyntaxNode(node.rvalue);
      this.inferenceEngine.addAssignmentConstraint(existingVariableStatusInStack.typeWrapper, rvalueTypeWrapper);
    }
    return existingVariableStatusInStack.typeWrapper;
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): TypeWrapper {
    this.beginScope(true, node)
    const parameterTypeWrappers = this.initializeFunctionParameters(node, node.parameterList);
    this.resolveList(node.statementList);
    const observedReturnTypeWrappers = this.scope.getObservedReturnTypeWrappers();
    const inferredReturnTypeWrapper = this.inferenceEngine.addCoercion(node, observedReturnTypeWrappers);
    this.endScope();

    const functionTypeWrapper = new TypeWrapper(node, primitiveTypes.any); // TODO: maybe: lookup hoisted functions?
    this.inferenceEngine.applyFunctionConstraints(functionTypeWrapper, this.scope, node.parameterList.map(fp => fp.typeAnnotation), node.returnTypeAnnotation, inferredReturnTypeWrapper);
    return functionTypeWrapper;
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): TypeWrapper {
    const calleeTypeWrapper = this.resolveSyntaxNode(node.callee);
    const argumentTypeWrappers: Array<TypeWrapper> = [];
    node.argumentList.forEach((argumentNode) => {
      const argumentTypeWrapper = this.resolveSyntaxNode(argumentNode);
      argumentTypeWrappers.push(argumentTypeWrapper);
    });
    const returnTypeWrapper = this.inferenceEngine.getReturnTypeWrapperForCall(calleeTypeWrapper, argumentTypeWrappers);
    return returnTypeWrapper;
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): TypeWrapper {
    let returnTypeWrapper: TypeWrapper = new TypeWrapper(node.retvalExpr ?? `implied void return value`, primitiveTypes.void);
    if (node.retvalExpr) {
      returnTypeWrapper = this.resolveSyntaxNode(node.retvalExpr)
    }
    this.scope.findClosestFunctionScope().registerObservedReturnTypeWrapper(returnTypeWrapper);
    return returnTypeWrapper;
  }
  visitMemberLookup(node: MemberLookupSyntaxNode): TypeWrapper {
    const objectTypeWrapper = this.resolveSyntaxNode(node.object);
    const propertyTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(objectTypeWrapper, node.memberName.lexeme);
    return propertyTypeWrapper;
    // const classType = objectTypeWrapper.getClassType();
    // const propertyTypeWrapper = classType.getPropertyTypeWrapper(node.memberName.lexeme);
    // return propertyTypeWrapper;
  }
  visitMemberAssignment(node: MemberAssignmentSyntaxNode): TypeWrapper {
    const rvalueTypeWrapper = this.resolveSyntaxNode(node.rvalue);
    const objectTypeWrapper = this.resolveSyntaxNode(node.object);

    const propertyTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(objectTypeWrapper, node.memberName.lexeme);
    this.inferenceEngine.addAssignmentConstraint(propertyTypeWrapper, rvalueTypeWrapper);
    return propertyTypeWrapper;

    // const classType = objectTypeWrapper.getClassType();
    // const propertyTypeWrapper = classType.getFieldTypeWrapper(node.memberName.lexeme);
    // propertyTypeWrapper.addAssignmentConstraint(rvalueTypeWrapper);
    // return propertyTypeWrapper;
  }
}
