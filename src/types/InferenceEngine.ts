import { ResolverScope } from "../compiler/resolver/ResolverScope"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { TypeAnnotation } from "../compiler/syntax/TypeAnnotation"
import { mapGetOrPut, throwExpr } from "../util"
import { ArgumentConstraint, CoercionConstraint, InferenceEngineSolver, InferenceEngineState, PropertyConstraint, ReturnConstraint } from "./InferenceEngineSolver"
import { UnresolvedCoercionType, SyntheticType, TypeWrapper, UnresolvedAnnotatedType, primitiveTypes, FunctionType } from "./types"

class UnappliedTypeAnnotation {
  constructor(
    public typeWrapper: TypeWrapper,
    public resolverScope: ResolverScope,
    public typeAnnotation: TypeAnnotation,
  ) { }
}

class UnappliedFunctionAnnotation {
  constructor(
    public functionTypeWrapper: TypeWrapper,
    public resolverScope: ResolverScope,
    public parameterTypeAnnotations: Array<TypeAnnotation | null>,
    public returnTypeAnnotation: TypeAnnotation | null,
  ) { }
}

export class InferenceEngine {
  private state: InferenceEngineState = new InferenceEngineState();
  private solver: InferenceEngineSolver = new InferenceEngineSolver(this.state);
  private calleeToReturnCache: Map<TypeWrapper, TypeWrapper> = new Map();
  private classPropertyCache: Map<TypeWrapper, Map<string, TypeWrapper>> = new Map();
  private unappliedTypeAnnotations: Array<UnappliedTypeAnnotation> = []; // annotations for vars, function/method parameters, class fields, and declared types
  private unappliedFunctionAnnotations: Array<UnappliedFunctionAnnotation> = []; // annotations for params and return type

  applyAnnotationConstraint(typeWrapper: TypeWrapper, resolverScope: ResolverScope, typeAnnotation: TypeAnnotation | null) {
    if (typeAnnotation !== null) {
      this.unappliedTypeAnnotations.push(new UnappliedTypeAnnotation(typeWrapper, resolverScope, typeAnnotation))
    }
  }
  addCoercion(lvalueReferenceNode: SyntaxNode | string, typeWrappers: Array<TypeWrapper>): TypeWrapper {
    if (typeWrappers.length === 0) {
      return new TypeWrapper(lvalueReferenceNode, primitiveTypes.void)
    }
    const unresolvedMultiCoercionTypeWrapper = new TypeWrapper(lvalueReferenceNode, primitiveTypes.any)
    this.state.coercionConstraints.push(new CoercionConstraint(typeWrappers, unresolvedMultiCoercionTypeWrapper));
    return unresolvedMultiCoercionTypeWrapper;
  }
  addAssignmentConstraint(lvalueTypeWrapper: TypeWrapper, rvalueTypeWrapper: TypeWrapper) {
    this.state.coercionConstraints.push(new CoercionConstraint([rvalueTypeWrapper], lvalueTypeWrapper));
    // this.state.assignmentConstraints.push(new AssignmentConstraint(lvalueTypeWrapper, rvalueTypeWrapper))
  }
  applyFunctionConstraints(functionTypeWrapper: TypeWrapper, resolverScope: ResolverScope, parameterTypeAnnotations: Array<TypeAnnotation | null>, returnTypeAnnotation: TypeAnnotation | null, inferredReturnTypeWrapper: TypeWrapper) {
    this.unappliedFunctionAnnotations.push(new UnappliedFunctionAnnotation(functionTypeWrapper, resolverScope, parameterTypeAnnotations, returnTypeAnnotation))
    this.state.returnConstraints.push(new ReturnConstraint(functionTypeWrapper, inferredReturnTypeWrapper))
  }
  getReturnTypeWrapperForCall(calleeTypeWrapper: TypeWrapper, argumentTypeWrappers: Array<TypeWrapper>): TypeWrapper {
    const returnTypeWrapper = mapGetOrPut(this.calleeToReturnCache, calleeTypeWrapper, () => new TypeWrapper(calleeTypeWrapper.referenceNode, primitiveTypes.any))
    this.state.argumentConstraints.push(new ArgumentConstraint(calleeTypeWrapper, argumentTypeWrappers))
    this.state.returnConstraints.push(new ReturnConstraint(calleeTypeWrapper, returnTypeWrapper))
    return returnTypeWrapper
  }
  getPropertyTypeWrapper(objectTypeWrapper: TypeWrapper, propertyName: string): TypeWrapper {
    const propertyCache = mapGetOrPut(this.classPropertyCache, objectTypeWrapper, () => new Map())
    const propertyTypeWrapper = mapGetOrPut(propertyCache, propertyName, () => new TypeWrapper(objectTypeWrapper.referenceNode, primitiveTypes.any))
    this.state.propertyConstraints.push(new PropertyConstraint(objectTypeWrapper, propertyName, propertyTypeWrapper))
    return propertyTypeWrapper
  }

  solve() {
    this.finalizeTypeAnnotations();
    this.finalizeFunctionAnnotations();
    this.solver.solve();
  }

  finalizeTypeAnnotations() {
    this.unappliedTypeAnnotations.forEach(uta => {
      const foundTypeWrapper = uta.resolverScope.lookupTypeWrapper(uta.typeAnnotation.name.lexeme) ?? throwExpr(new Error(`type annotation not found: ${uta.typeAnnotation.name.lexeme}`));
      if (uta.typeWrapper.type !== primitiveTypes.any) {
        throw new Error(`InferenceEngine failed to finalize annotations: typeWrapper expected to be any, but was "${uta.typeWrapper.toString()}"`);
      }
      uta.typeWrapper.type = foundTypeWrapper.type;
    });
  }
  finalizeFunctionAnnotations() {
    this.unappliedFunctionAnnotations.forEach(ufa => {
      if (ufa.functionTypeWrapper.type !== primitiveTypes.any) {
        throw new Error(`InferenceEngine failed to finalize annotations: typeWrapper expected to be any, but was "${ufa.functionTypeWrapper.toString()}"`);
      }
      let returnTypeWrapper = new TypeWrapper(ufa.functionTypeWrapper.referenceNode, primitiveTypes.any);
      if (ufa.returnTypeAnnotation) {
        returnTypeWrapper = ufa.resolverScope.lookupTypeWrapper(ufa.returnTypeAnnotation.name.lexeme) ?? throwExpr(new Error(`return type annotation not found`));
      }
      const parameterTypeWrappers: Array<TypeWrapper> = [];
      ufa.parameterTypeAnnotations.forEach(parameterAnnotation => {
        let parameterTypeWrapper = new TypeWrapper(ufa.functionTypeWrapper.referenceNode, primitiveTypes.any);
        if (parameterAnnotation !== null) {
          parameterTypeWrapper = ufa.resolverScope.lookupTypeWrapper(parameterAnnotation.name.lexeme) ?? throwExpr(new Error(`parameter type annotation not found`))
        }
        parameterTypeWrappers.push(parameterTypeWrapper);
      });
      ufa.functionTypeWrapper.type = new FunctionType(ufa.resolverScope, parameterTypeWrappers, returnTypeWrapper);
    });
  }
}
