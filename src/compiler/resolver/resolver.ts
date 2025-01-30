import {
  ClassDeclarationSyntaxNode,
  FunctionCallSyntaxNode,
  MemberLookupSyntaxNode,
  GroupingSyntaxNode,
  IfStatementSyntaxNode,
  LiteralSyntaxNode,
  LogicShortCircuitSyntaxNode,
  MemberAssignmentSyntaxNode,
  ObjectInstantiationSyntaxNode,
  ReturnStatementSyntaxNode,
  StatementBlockSyntaxNode,
  SyntaxNode,
  ISyntaxNodeVisitor,
  TypeDeclarationSyntaxNode,
  VariableAssignmentSyntaxNode,
  VariableLookupSyntaxNode,
  WhileStatementSyntaxNode,
  FunctionOverloadSyntaxNode,
  FunctionDefinitionSyntaxNode,
} from '../syntax/syntax'
import { ErrorWithSourcePos } from '../../ErrorWithSourcePos'
import { TokenType } from '../Token'
import { parse } from '../parser/parser'
import { CompileError } from '../CompileError'
import { FunctionParameter } from '../syntax/FunctionParameter'
import { InternalError } from '../../util'
import { IResolverScopeOutput, ResolverScope } from './ResolverScope'
import { ValueType } from '../syntax/ValueType'
import {
  ClassType,
  FunctionHomonymType,
  primitiveTypes,
  primitiveTypesMap,
  ReadOnlyStatus,
  TypeWrapper,
  UnresolvedAnnotatedType,
  untypedType,
} from '../../types/types'
import { builtinsByName } from '../../builtins/builtins'
import { InferenceEngine } from '../../types/InferenceEngine'
import { TypeAnnotation } from '../syntax/TypeAnnotation'

export interface IResolverOutput {
  scopesByNode: Map<SyntaxNode, IResolverScopeOutput>
  classNodesByClassTypeWrapper: Map<TypeWrapper, ClassDeclarationSyntaxNode>
}

interface IResolverResponse {
  ast: SyntaxNode
  resolverOutput: IResolverOutput
}

export function resolve(source: string, path: string, isDebug: boolean): IResolverResponse {
  const ast = parse(source, path, isDebug)
  const resolver = new Resolver(isDebug)
  const resolverErrors = resolver.resolve(ast)
  if (resolverErrors.length > 0) {
    throw new CompileError(resolverErrors)
  }
  const resolverOutput = resolver as IResolverOutput
  return { ast, resolverOutput }
}

export class Resolver implements ISyntaxNodeVisitor<TypeWrapper>, IResolverOutput {
  scope: ResolverScope
  scopesByNode: Map<SyntaxNode, ResolverScope> = new Map()
  classNodesByClassTypeWrapper: Map<TypeWrapper, ClassDeclarationSyntaxNode> = new Map()
  inferenceEngine: InferenceEngine
  resolverErrors: Array<ErrorWithSourcePos> = []
  constructor(
    public isDebug: boolean,
  ) {
    this.inferenceEngine = new InferenceEngine(this.isDebug)
    const topScope = new ResolverScope(this, null, false, null)
    builtinsByName.forEach((builtin, builtinName) => {
      topScope.initializeVariable(builtinName, builtin.getTypeWrapper(), ReadOnlyStatus.ReadOnly)
    })
    primitiveTypesMap.forEach((type, typeName) => {
      topScope.typeWrappers.set(typeName, new TypeWrapper(`primitiveType(${typeName})`, type))
    })
    this.scope = topScope
  }
  beginScope(isFunctionScope: boolean, node: SyntaxNode): void {
    const newScope = new ResolverScope(this, node, isFunctionScope, this.scope)
    this.scopesByNode.set(node, newScope)
    this.scope = newScope
  }
  initializeFunctionParameters(node: SyntaxNode, functionParameters: Array<FunctionParameter>): Array<TypeWrapper> {
    return functionParameters.map((functionParameter) => {
      const parameterName = functionParameter.identifier.lexeme
      this.disallowShadowing(parameterName, node)
      const parameterTypeWrapper = new TypeWrapper(node, untypedType)
      this.inferenceEngine.applyAnnotationConstraint(parameterTypeWrapper, this.scope, functionParameter.typeAnnotation)
      this.scope.initializeVariable(parameterName, parameterTypeWrapper, ReadOnlyStatus.ReadOnly)
      return parameterTypeWrapper
    })

  }
  endScope(): void {
    if (this.scope.parentScope === null) {
      throw new InternalError('internal logic error: attempted to leave global scope')
    }
    this.scope = this.scope.parentScope
  }

  generateResolverError(node: SyntaxNode, message: string): ErrorWithSourcePos {
    const resolverError = new ErrorWithSourcePos('Resolver: ' + message, node.referenceToken.path, node.referenceToken.charPos)
    this.resolverErrors.push(resolverError)
    return resolverError
  }


  resolve(node: SyntaxNode): Array<ErrorWithSourcePos> {
    this.resolverErrors = []
    this.resolveSyntaxNode(node)
    if (this.resolverErrors.length > 0) {
      return this.resolverErrors
    }
    this.inferenceEngine.solve()
    return this.resolverErrors
  }

  resolveSyntaxNode(node: SyntaxNode): TypeWrapper {
    return node.accept(this)
  }
  resolveList(nodeList: Array<SyntaxNode>): void {
    for (const node of nodeList) {
      const discardedTypeWrapper = this.resolveSyntaxNode(node)
      const outputTypeWrapper = this.inferenceEngine.addCoercion(node, [ discardedTypeWrapper ])
      outputTypeWrapper.type = primitiveTypes.void
    }
  }
  visitLiteral(node: LiteralSyntaxNode): TypeWrapper {
    if (node.type === ValueType.BOOLEAN) {
      return new TypeWrapper(node, primitiveTypes.bool32)
    }
    else if (node.type === ValueType.NUMBER) {
      return new TypeWrapper(node, primitiveTypes.float32)
    }
    else {
      throw new InternalError('TODO: other literal types')
    }
  }
  visitGrouping(node: GroupingSyntaxNode): TypeWrapper {
    return this.resolveSyntaxNode(node.expr)
  }
  visitStatementBlock(node: StatementBlockSyntaxNode): TypeWrapper {
    this.beginScope(false, node)
    this.resolveList(node.statementList)
    this.endScope()
    return new TypeWrapper(node, primitiveTypes.never)
  }
  visitIfStatement(node: IfStatementSyntaxNode): TypeWrapper {
    const condTypeWrapper = this.resolveSyntaxNode(node.cond)
    this.inferenceEngine.addAssignmentConstraint(new TypeWrapper(node.cond, primitiveTypes.bool32), condTypeWrapper) // TODO: rename InferenceEngine.addAssignmentConstraint because this isn't assignment!
    this.resolveSyntaxNode(node.thenBranch)
    if (node.elseBranch !== null) {
      this.resolveSyntaxNode(node.elseBranch)
    }

    // late-const branch initialization feature
    const thenInitializedVars = this.scopesByNode.get(node.thenBranch)!.initializedVars
    const elseInitializedVars: Set<string> = node.elseBranch !== null ? this.scopesByNode.get(node.elseBranch)!.initializedVars : new Set()
    const bothInitializedVars = new Set([ ...thenInitializedVars, ...elseInitializedVars ])
    const xorInitializedVars = new Set([
      ...[ ...thenInitializedVars ].filter((x) => !elseInitializedVars.has(x)),
      ...[ ...elseInitializedVars ].filter((x) => !thenInitializedVars.has(x)),
    ])
    bothInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.lookupVariableAndWireUpClosures(identifier)
      if (parentVarStatus !== null) {
        this.scope.assignVariable(identifier)
      }
    })
    xorInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.lookupVariableAndWireUpClosures(identifier)
      if (parentVarStatus !== null && parentVarStatus.isReadOnly()) {
        this.generateResolverError(node, `Late const assignment of variable "${identifier}" must occur in all branches`)
      }
    })
    return new TypeWrapper(node, primitiveTypes.never)
  }
  visitWhileStatement(node: WhileStatementSyntaxNode): TypeWrapper {
    this.resolveSyntaxNode(node.cond)
    this.resolveSyntaxNode(node.loopBody)
    const loopInitializedVars = this.scopesByNode.get(node.loopBody)!.initializedVars
    loopInitializedVars.forEach((identifier) => {
      const parentVarStatus = this.scope.lookupVariableAndWireUpClosures(identifier)
      if (parentVarStatus !== null && parentVarStatus.isReadOnly()) {
        this.generateResolverError(node, `Late const assignment of variable "${identifier}" may not occur in a loop`)
      }
    })
    return new TypeWrapper(node, primitiveTypes.never)
  }
  visitLogicShortCircuit(node: LogicShortCircuitSyntaxNode): TypeWrapper {
    const leftTypeWrapper = this.resolveSyntaxNode(node.left)
    const rightTypeWrapper = this.resolveSyntaxNode(node.right)
    return this.inferenceEngine.addCoercion(node, [ leftTypeWrapper, rightTypeWrapper ])
  }
  disallowShadowing(identifier: string, referenceNode: SyntaxNode): void {
    if (this.scope.lookupVariableAndWireUpClosures(identifier) !== null) {
      this.generateResolverError(referenceNode, 'Variable/parameter/field shadowing is not allowed')
    }
  }
  visitClassDeclaration(node: ClassDeclarationSyntaxNode): TypeWrapper {
    const className = node.newClassName.lexeme
    let baseClassTypeWrapper: TypeWrapper | null = null
    if (node.baseClassName !== null) {
      baseClassTypeWrapper = this.scope.lookupTypeWrapper(node.baseClassName.lexeme)
      if (baseClassTypeWrapper === null) {
        this.generateResolverError(node, 'failed to lookup base class')
        return new TypeWrapper(node, primitiveTypes.never)
      }
    }
    const interfaceTypeWrappers: Array<TypeWrapper> = []
    node.implementedInterfaceNames.forEach((interfaceNameToken) => {
      const interfaceTypeWrapper = this.scope.lookupTypeWrapper(interfaceNameToken.lexeme)
      if (interfaceTypeWrapper === null) {
        this.generateResolverError(node, 'failed to lookup interface')
        // return new TypeWrapper(node, primitiveTypes.never)
      }
      else {
        interfaceTypeWrappers.push(interfaceTypeWrapper)
      }
    })

    const classTypeWrapper = new TypeWrapper(node, new UnresolvedAnnotatedType(this.scope, new TypeAnnotation(node.newClassName, undefined)))

    const fields: Map<string, TypeWrapper> = new Map()
    node.fields.forEach((typeAnnotation, fieldName) => {
      this.disallowShadowing(fieldName, node)
      const fieldTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(classTypeWrapper, fieldName)
      this.inferenceEngine.applyAnnotationConstraint(fieldTypeWrapper, this.scope, typeAnnotation)
      fields.set(fieldName, fieldTypeWrapper)
    })
    const methods: Map<string, TypeWrapper> = new Map()
    node.methods.forEach((typeAnnotation, methodName) => {
      this.disallowShadowing(methodName, node)
      const methodTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(classTypeWrapper, methodName)
      methods.set(methodName, methodTypeWrapper)
    })
    const classType = new ClassType(
      this.scope, // resolverScope
      node.referenceToken, // referenceToken
      className, // name
      node.genericDefinition, // genericDefinition
      baseClassTypeWrapper, // baseClassType
      interfaceTypeWrappers, // interfaceTypes
      fields, // fields
      methods, // methods
    )
    classTypeWrapper.type = classType
    this.scope.declareType(node, classType.name, classTypeWrapper)

    // traverse methods
    this.beginScope(false, node) // field scope
    const classScope = this.scope
    classType.fields.forEach((typeWrapper, fieldName) => {
      this.scope.initializeVariable(fieldName, typeWrapper, ReadOnlyStatus.Mutable)
    })
    this.scope.initializeVariable('this', classTypeWrapper, ReadOnlyStatus.ReadOnly)
    node.methods.forEach((methodNode, methodName) => {
      const methodTypeWrapper = this.visitFunctionDefinition(methodNode)
      const _propertyTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(classTypeWrapper, methodName)
      this.inferenceEngine.addAssignmentConstraint(_propertyTypeWrapper, methodTypeWrapper)
    })
    this.endScope()

    this.classNodesByClassTypeWrapper.set(classTypeWrapper, node)
    this.scopesByNode.set(node, classScope) // unnecessary?

    return new TypeWrapper(node, primitiveTypes.never)
  }
  visitTypeDeclaration(node: TypeDeclarationSyntaxNode): TypeWrapper {
    const typeWrapper = new TypeWrapper(node, untypedType)
    this.inferenceEngine.applyAnnotationConstraint(typeWrapper, this.scope, node.typeAnnotation)
    this.scope.declareType(node, node.identifier.lexeme, typeWrapper)
    return new TypeWrapper(node, primitiveTypes.never)
  }
  visitObjectInstantiation(node: ObjectInstantiationSyntaxNode): TypeWrapper {
    const classType = this.scope.lookupTypeWrapper(node.className.lexeme)
    if (classType === null) {
      this.generateResolverError(node, 'could not find class referenced by "new"')
      return new TypeWrapper(node, primitiveTypes.never)
    }
    for (const argument of node.constructorArgumentList) {
      const _argumentTypeWrapper = this.resolveSyntaxNode(argument)
      // TODO: verify types of arguments match classType's constructor's parameter types
    }
    return classType
  }
  visitVariableLookup(node: VariableLookupSyntaxNode): TypeWrapper {
    const identifier = node.identifier.lexeme
    const existingVariableStatusInStack = this.scope.lookupVariableAndWireUpClosures(identifier)
    if (existingVariableStatusInStack === null) {
      this.generateResolverError(node, `Undeclared variable "${identifier}" cannot be substituted`)
      return new TypeWrapper(node, primitiveTypes.never)
    }
    else {
      if (!this.scope.isVariableInitialized(identifier)) {
        this.generateResolverError(node, `Uninitialized variable "${identifier}" cannot be substituted`)
      }
    }
    return existingVariableStatusInStack.typeWrapper
  }
  visitVariableAssignment(node: VariableAssignmentSyntaxNode): TypeWrapper {
    const declarationModifier = node.modifier
    const identifier = node.identifier.lexeme
    let existingVariableStatusInStack = this.scope.lookupVariableAndWireUpClosures(identifier)
    let isShadowing = false
    if (declarationModifier !== null) {
      if (existingVariableStatusInStack !== null) {
        this.generateResolverError(node, 'Variable/parameter/field shadowing is not allowed')
        isShadowing = true // don't also report "Constant variable cannot be re-assigned to"
      }
      const typeWrapper = new TypeWrapper(node, untypedType)
      this.inferenceEngine.applyAnnotationConstraint(typeWrapper, this.scope, node.typeAnnotation)
      const readOnlyStatus = declarationModifier.type === TokenType.KEYWORD_CONST ? ReadOnlyStatus.ReadOnly : ReadOnlyStatus.Mutable
      existingVariableStatusInStack = this.scope.declareVariable(identifier, typeWrapper, readOnlyStatus)
    }
    else {
      if (existingVariableStatusInStack === null) {
        this.generateResolverError(node, 'Undeclared variable cannot be assigned to')
        return new TypeWrapper(node, primitiveTypes.never)
      }
    }
    if (node.rvalue !== null) {
      if (this.scope.isVariableInitialized(identifier) && existingVariableStatusInStack.isReadOnly() && !isShadowing) {
        this.generateResolverError(node, 'Constant variable cannot be re-assigned to')
      }
      this.scope.assignVariable(identifier)
      const rvalueTypeWrapper: TypeWrapper = this.resolveSyntaxNode(node.rvalue)
      this.inferenceEngine.addAssignmentConstraint(existingVariableStatusInStack.typeWrapper, rvalueTypeWrapper)
    }
    return existingVariableStatusInStack.typeWrapper
  }
  visitFunctionDefinition(node: FunctionDefinitionSyntaxNode): TypeWrapper {
    const overloadTypeWrappers = node.overloads.map((overload) => {
      this.beginScope(true, node)
      const parameterTypeWrappers = this.initializeFunctionParameters(node, overload.parameterList)
      this.resolveList(overload.statementList)
      const observedReturnTypeWrappers = this.scope.getObservedReturnTypeWrappers()
      const returnTypeWrapper = this.inferenceEngine.addCoercion(node, observedReturnTypeWrappers)
      this.endScope()

      const functionOverloadTypeWrapper = new TypeWrapper(node, untypedType)
      this.inferenceEngine.applyFunctionOverloadConstraints(
        this.scope,
        functionOverloadTypeWrapper,
        parameterTypeWrappers,
        overload.parameterList.map((fp) => fp.typeAnnotation),
        overload.returnTypeAnnotation,
        returnTypeWrapper,
      )
      return functionOverloadTypeWrapper
    })
    return new TypeWrapper(node, new FunctionHomonymType(overloadTypeWrappers))
  }
  visitFunctionOverload(node: FunctionOverloadSyntaxNode): TypeWrapper {
    // This should never be called directly since we handle overloads in visitFunctionDefinition
    throw new Error("FunctionOverload nodes should be handled by FunctionDefinition visitor")
  }
  visitFunctionCall(node: FunctionCallSyntaxNode): TypeWrapper {
    const calleeTypeWrapper = this.resolveSyntaxNode(node.callee)
    const argumentTypeWrappers: Array<TypeWrapper> = []
    node.argumentList.forEach((argumentNode) => {
      const argumentTypeWrapper = this.resolveSyntaxNode(argumentNode)
      argumentTypeWrappers.push(argumentTypeWrapper)
    })
    const returnTypeWrapper = new TypeWrapper(node, untypedType)
    this.inferenceEngine.addCallConstraint(calleeTypeWrapper, argumentTypeWrappers, returnTypeWrapper)
    return returnTypeWrapper
  }
  visitReturnStatement(node: ReturnStatementSyntaxNode): TypeWrapper {
    let returnTypeWrapper: TypeWrapper = new TypeWrapper(node.retvalExpr ?? 'implied void return value', primitiveTypes.void)
    if (node.retvalExpr) {
      returnTypeWrapper = this.resolveSyntaxNode(node.retvalExpr)
    }
    this.scope.findClosestFunctionScope().registerObservedReturnTypeWrapper(returnTypeWrapper)
    return returnTypeWrapper
  }
  visitMemberLookup(node: MemberLookupSyntaxNode): TypeWrapper {
    const objectTypeWrapper = this.resolveSyntaxNode(node.object)
    const propertyTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(objectTypeWrapper, node.memberName.lexeme)
    return propertyTypeWrapper
    // const classType = objectTypeWrapper.getClassType();
    // const propertyTypeWrapper = classType.getPropertyTypeWrapper(node.memberName.lexeme);
    // return propertyTypeWrapper;
  }
  visitMemberAssignment(node: MemberAssignmentSyntaxNode): TypeWrapper {
    const rvalueTypeWrapper = this.resolveSyntaxNode(node.rvalue)
    const objectTypeWrapper = this.resolveSyntaxNode(node.object)

    const propertyTypeWrapper = this.inferenceEngine.getPropertyTypeWrapper(objectTypeWrapper, node.memberName.lexeme)
    this.inferenceEngine.addAssignmentConstraint(propertyTypeWrapper, rvalueTypeWrapper)
    return propertyTypeWrapper

    // const classType = objectTypeWrapper.getClassType();
    // const propertyTypeWrapper = classType.getFieldTypeWrapper(node.memberName.lexeme);
    // propertyTypeWrapper.addAssignmentConstraint(rvalueTypeWrapper);
    // return propertyTypeWrapper;
  }
}
