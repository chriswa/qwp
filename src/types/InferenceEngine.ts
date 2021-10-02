import { ResolverScope } from '../compiler/resolver/ResolverScope'
import { SyntaxNode } from '../compiler/syntax/syntax'
import { TypeAnnotation } from '../compiler/syntax/TypeAnnotation'
import { mapGetOrPut, throwExpr } from '../util'
import { FunctionCallConstraint, CoercionConstraint, FunctionOverloadConstraint, InferenceEngineConstraints, PropertyConstraint } from './constraints'
import { InferenceEngineSolver } from './InferenceEngineSolver'
import { TypeWrapper, primitiveTypes, untypedType, FunctionOverloadType } from './types'

class UnappliedTypeAnnotation {
  constructor(
    public resolverScope: ResolverScope,
    public typeWrapper: TypeWrapper,
    public typeAnnotation: TypeAnnotation,
  ) { }
}

class UnappliedFunctionOverloadAnnotation {
  constructor(
    public resolverScope: ResolverScope,
    public functionOverloadTypeWrapper: TypeWrapper,
    public parameterTypeWrappers: Array<TypeWrapper>,
    public parameterTypeAnnotations: Array<TypeAnnotation | null>,
    public returnTypeAnnotation: TypeAnnotation | null,
  ) { }
}

export class InferenceEngine {
  private constraints: InferenceEngineConstraints = new InferenceEngineConstraints()
  private solver: InferenceEngineSolver
  private classPropertyCache: Map<TypeWrapper, Map<string, TypeWrapper>> = new Map()
  private unappliedTypeAnnotations: Array<UnappliedTypeAnnotation> = [] // annotations for vars, function/method parameters, class fields, and declared types
  private unappliedFunctionOverloadAnnotations: Array<UnappliedFunctionOverloadAnnotation> = [] // annotations for params and return type

  constructor(
    public isDebug: boolean,
  ) {
    this.solver = new InferenceEngineSolver(this.constraints, this.isDebug)
  }

  applyAnnotationConstraint(typeWrapper: TypeWrapper, resolverScope: ResolverScope, typeAnnotation: TypeAnnotation | null): void {
    if (typeAnnotation !== null) {
      this.unappliedTypeAnnotations.push(new UnappliedTypeAnnotation(resolverScope, typeWrapper, typeAnnotation))
    }
  }
  addCoercion(lvalueReferenceNode: SyntaxNode | string, typeWrappers: Array<TypeWrapper>): TypeWrapper {
    if (typeWrappers.length === 0) {
      return new TypeWrapper(lvalueReferenceNode, primitiveTypes.void)
    }
    const outputTypeWrapper = new TypeWrapper(lvalueReferenceNode, untypedType)
    this.constraints.addCoercionConstraint(new CoercionConstraint(typeWrappers, outputTypeWrapper))
    return outputTypeWrapper
  }
  addAssignmentConstraint(lvalueTypeWrapper: TypeWrapper, rvalueTypeWrapper: TypeWrapper): void {
    const coercionConstraint = this.constraints.getOrCreateCoercionConstraintByOutputTypeWrapper(lvalueTypeWrapper)
    coercionConstraint.inputTypeWrappers.push(rvalueTypeWrapper)
  }
  applyFunctionOverloadConstraints(
    resolverScope: ResolverScope,
    functionOverloadTypeWrapper: TypeWrapper,
    parameterTypeWrappers: Array<TypeWrapper>,
    parameterTypeAnnotations: Array<TypeAnnotation | null>,
    returnTypeAnnotation: TypeAnnotation | null,
    returnTypeWrapper: TypeWrapper,
  ): void {
    this.unappliedFunctionOverloadAnnotations.push(new UnappliedFunctionOverloadAnnotation(resolverScope, functionOverloadTypeWrapper, parameterTypeWrappers, parameterTypeAnnotations, returnTypeAnnotation))
    this.constraints.functionOverloadConstraints.push(new FunctionOverloadConstraint(functionOverloadTypeWrapper, parameterTypeWrappers, returnTypeWrapper))
  }
  addCallConstraint(calleeTypeWrapper: TypeWrapper, argumentTypeWrappers: Array<TypeWrapper>, returnTypeWrapper: TypeWrapper): TypeWrapper {
    this.constraints.functionCallConstraints.push(new FunctionCallConstraint(calleeTypeWrapper, argumentTypeWrappers, returnTypeWrapper))
    return returnTypeWrapper
  }
  getPropertyTypeWrapper(objectTypeWrapper: TypeWrapper, propertyName: string): TypeWrapper {
    const propertyCache = mapGetOrPut(this.classPropertyCache, objectTypeWrapper, () => new Map())
    const propertyTypeWrapper = mapGetOrPut(propertyCache, propertyName, () => new TypeWrapper(objectTypeWrapper.referenceNode, untypedType))
    this.constraints.propertyConstraints.push(new PropertyConstraint(objectTypeWrapper, propertyName, propertyTypeWrapper))
    return propertyTypeWrapper
  }

  solve(): void {
    this.finalizeTypeAnnotations()
    this.finalizeFunctionOverloadAnnotations()
    this.solver.solve()
  }

  finalizeTypeAnnotations(): void {
    this.unappliedTypeAnnotations.forEach((uta) => {
      const foundTypeWrapper = uta.resolverScope.lookupTypeWrapper(uta.typeAnnotation.name.lexeme) ?? throwExpr(new Error(`type annotation not resolvable: ${uta.typeAnnotation.name.lexeme}`))
      if (uta.typeWrapper.type !== untypedType) {
        throw new Error(`InferenceEngine failed to finalize finalizeTypeAnnotations: typeWrapper expected to be any, but was "${uta.typeWrapper.toString()}"`)
      }
      uta.typeWrapper.type = foundTypeWrapper.type
    })
  }
  finalizeFunctionOverloadAnnotations(): void {
    this.unappliedFunctionOverloadAnnotations.forEach((ufa) => {
      if (ufa.functionOverloadTypeWrapper.type !== untypedType) {
        throw new Error(`InferenceEngine failed to finalize finalizeFunctionOverloadAnnotations: typeWrapper expected to be any, but was "${ufa.functionOverloadTypeWrapper.toString()}"`)
      }
      let returnTypeWrapper = new TypeWrapper(ufa.functionOverloadTypeWrapper.referenceNode, untypedType)
      if (ufa.returnTypeAnnotation) {
        returnTypeWrapper = ufa.resolverScope.lookupTypeWrapper(ufa.returnTypeAnnotation.name.lexeme) ?? throwExpr(new Error(`return type annotation not resolvable: ${ufa.returnTypeAnnotation.name.lexeme}`))
      }
      ufa.parameterTypeWrappers.forEach((parameterTypeWrapper, index) => {
        const parameterAnnotation = ufa.parameterTypeAnnotations[ index ]
        if (parameterAnnotation !== null) {
          ufa.parameterTypeWrappers[ index ] = ufa.resolverScope.lookupTypeWrapper(parameterAnnotation.name.lexeme) ?? throwExpr(new Error(`parameter type annotation not resolvable: ${parameterAnnotation.name.lexeme}`))
        }
      })
      ufa.functionOverloadTypeWrapper.type = new FunctionOverloadType(ufa.resolverScope, ufa.parameterTypeWrappers, returnTypeWrapper)
    })
  }
}
