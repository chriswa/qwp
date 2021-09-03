import chalk from "chalk"
import { SyntaxNode } from "../compiler/syntax/syntax"
import { TypeWrapper } from "./types"

export class CoercionConstraint {
  constructor(
    public inputTypeWrappers: Array<TypeWrapper>,
    public outputTypeWrapper: TypeWrapper,
  ) { }
}

// export class AssignmentConstraint {
//   constructor(
//     public lvalueTypeWrapper: TypeWrapper,
//     public rvalueTypeWrapper: TypeWrapper,
//   ) { }
// }

export class ArgumentConstraint {
  constructor(
    public calleeTypeWrapper: TypeWrapper,
    public argumentTypeWrappers: Array<TypeWrapper>,
  ) { }
}

export class ReturnConstraint {
  constructor(
    public calleeTypeWrapper: TypeWrapper,
    public returnTypeWrapper: TypeWrapper,
  ) { }
}

export class PropertyConstraint {
  constructor(
    public objectTypeWrapper: TypeWrapper,
    public propertyName: string,
    public propertyTypeWrapper: TypeWrapper, // ?
  ) { }
}

export class InferenceEngineState {
  public coercionConstraints: Array<CoercionConstraint> = []; // one or more types being coerced into another type
  // public assignmentConstraints: Array<AssignmentConstraint> = []; // one type being assigned to another type [is this the same as coercionConstraints?]
  public argumentConstraints: Array<ArgumentConstraint> = []; // argument constraints
  public returnConstraints: Array<ReturnConstraint> = []; // return constraints (both inferred (from function body) and consumed (from usages))
  public propertyConstraints: Array<PropertyConstraint> = []; // a class type has a field/method with a type
}

function displayNodeSourcePosition(label: string, referenceNodeOrDescription: SyntaxNode | string) {
  if (referenceNodeOrDescription instanceof SyntaxNode) {
    referenceNodeOrDescription.referenceToken.printPositionInSource(label);
  }
  else {
    console.log(chalk.cyan(label + ': ') + referenceNodeOrDescription);
  }
}

export class InferenceEngineSolver {
  constructor(
    public state: InferenceEngineState,
  ) { }
  solve() {
    this.state.coercionConstraints.forEach(coercionConstraint => {
      console.log(chalk.bgWhite.black(`coercionConstraint: ${coercionConstraint.inputTypeWrappers.map(x => x.toString()).join(', ')} => ${coercionConstraint.outputTypeWrapper.toString()}`));
      coercionConstraint.inputTypeWrappers.forEach(inputTypeWrapper => {
        displayNodeSourcePosition('input', inputTypeWrapper.referenceNode);
      });
      displayNodeSourcePosition('output', coercionConstraint.outputTypeWrapper.referenceNode);
      if (coercionConstraint.inputTypeWrappers.every(inputTypeWrapper => inputTypeWrapper.isEqualTo(coercionConstraint.outputTypeWrapper))) {
        console.log(`TODO: constraint is resolved, remove it`)
      }
    });
    // this.state.assignmentConstraints.forEach(assignmentConstraint => {
    //   console.log(chalk.bgWhite.black(`assignmentConstraint: ${assignmentConstraint.rvalueTypeWrapper.toString()} => ${assignmentConstraint.lvalueTypeWrapper.toString()}`));
    //   displayNodeSourcePosition('rvalue', assignmentConstraint.rvalueTypeWrapper.referenceNode);
    //   displayNodeSourcePosition('lvalue', assignmentConstraint.lvalueTypeWrapper.referenceNode);
    //   if (assignmentConstraint.lvalueTypeWrapper.isEqualTo(assignmentConstraint.rvalueTypeWrapper)) {
    //     console.log(`TODO: constraint is resolved, remove it`);
    //   }
    // });
    this.state.argumentConstraints.forEach(argumentConstraint => {
      console.log(chalk.bgWhite.black(`argumentConstraint: call ${argumentConstraint.calleeTypeWrapper.toString()} with (${argumentConstraint.argumentTypeWrappers.map(x => x.toString()).join(', ')})`));
      displayNodeSourcePosition('callee', argumentConstraint.calleeTypeWrapper.referenceNode);
      argumentConstraint.argumentTypeWrappers.forEach(argumentTypeWrapper => {
        displayNodeSourcePosition('argument', argumentTypeWrapper.referenceNode);
      });
    });
    this.state.returnConstraints.forEach(returnConstraint => {
      console.log(chalk.bgWhite.black(`returnConstraint: call ${returnConstraint.calleeTypeWrapper.toString()} returns ${returnConstraint.returnTypeWrapper.toString()}`));
      displayNodeSourcePosition('callee', returnConstraint.calleeTypeWrapper.referenceNode);
      displayNodeSourcePosition('return', returnConstraint.returnTypeWrapper.referenceNode);
    });
    this.state.propertyConstraints.forEach(propertyConstraint => {
      console.log(chalk.bgWhite.black(`propertyConstraint: ${propertyConstraint.objectTypeWrapper.toString()} dot "${propertyConstraint.propertyName}" => ${propertyConstraint.propertyTypeWrapper.toString()}`));
      displayNodeSourcePosition('object', propertyConstraint.objectTypeWrapper.referenceNode);
      displayNodeSourcePosition('property', propertyConstraint.propertyTypeWrapper.referenceNode);
    });

    let shouldContinue = true;
    let iterationCount = 0;
    while (shouldContinue) {
      iterationCount += 1;
      if (iterationCount > 100) {
        throw new Error(`InferenceEngine.solve max iteration count exceeded!`);
      }
      shouldContinue = this.iterate();
    }

  }
  iterate(): boolean {
    let hasProgressBeenMade = false;
    throw new Error(`TODO: iterate!`);
    return hasProgressBeenMade;
  }
}
