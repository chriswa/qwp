import chalk from 'chalk'
import { drawBox } from '../testing/reporting'
import { InternalError } from '../util'
import { InferenceEngineConstraints } from './constraints'
import { primitiveTypes, Type, untypedType } from './types'

export class InferenceEngineSolver {
  constructor(
    public constraints: InferenceEngineConstraints,
    public isDebug: boolean,
  ) {
  }
  solve(): void {
    if (this.isDebug) { console.log(chalk.yellow(drawBox('InferenceEngineSolver.solve'))) }
    let shouldContinue = true
    let iterationCount = 0
    while (shouldContinue) {
      iterationCount += 1
      if (iterationCount > 100) {
        throw new InternalError('InferenceEngine.solve max iteration count exceeded!')
      }
      if (this.isDebug) { console.log(chalk.bgMagenta.black('=== INFERENCE ENGINE ITERATION ===')) }
      shouldContinue = this.iterate()
    }
    if (this.isDebug) { console.log(chalk.bgMagenta.black('=== INFERENCE ENGINE ITERATION COMPLETE === no more work to do!')) }

  }
  iterate(): boolean {
    let hasProgressBeenMade = false
    this.constraints.forEachCoercionConstraint((coercionConstraint) => {
      if (this.isDebug) { coercionConstraint.dump() }
      // if types are the same, remove the constaint
      if (coercionConstraint.inputTypeWrappers.every((inputTypeWrapper) => inputTypeWrapper.isEqualTo(coercionConstraint.outputTypeWrapper))) {
        if (this.isDebug) { console.log(chalk.yellow('-> types are the same, remove')) }
        this.constraints.removeCoercionConstraint(coercionConstraint)
        hasProgressBeenMade = true
        return
      }
      // if output is untyped and all inputs are typed, set output type to least general of all inputs
      const leastGeneralType = coercionConstraint.inputTypeWrappers.map((typeWrapper) => typeWrapper.type).reduce(getLeastGeneralCoercedType)
      if (leastGeneralType.isEqualTo(untypedType) === false && coercionConstraint.outputTypeWrapper.type.isEqualTo(untypedType)) {
        if (this.isDebug) { console.log(chalk.yellow('-> output is untyped and all inputs are typed, set output type to least general of all inputs')) }
        coercionConstraint.outputTypeWrapper.type = leastGeneralType
        hasProgressBeenMade = true
        return
      }
      // if output is void, discard the constraint, since the value is being discarded [this special case will go away once "output is typed" case supports implicitly casting anything to void]
      if (coercionConstraint.outputTypeWrapper.type.isEqualTo(primitiveTypes.void)) {
        coercionConstraint.inputTypeWrappers.forEach((inputTypeWrapper) => {
          if (inputTypeWrapper.type.isEqualTo(untypedType)) {
            inputTypeWrapper.type = coercionConstraint.outputTypeWrapper.type
          }
        })
        if (this.isDebug) { console.log(chalk.yellow('-> output is void, all untyped inputs are set to void and consrtaint removed')) }
        this.constraints.removeCoercionConstraint(coercionConstraint)
        hasProgressBeenMade = true
        return
      }
      // if output is typed, set all untyped inputs to it
      if (coercionConstraint.outputTypeWrapper.type.isEqualTo(untypedType) === false) {
        coercionConstraint.inputTypeWrappers.forEach((inputTypeWrapper) => {
          if (inputTypeWrapper.isEqualTo(coercionConstraint.outputTypeWrapper) === false) {
            if (inputTypeWrapper.type.isEqualTo(untypedType)) {
              if (this.isDebug) { console.log(chalk.yellow('-> output is typed, set all untyped inputs to it')) }
              inputTypeWrapper.type = coercionConstraint.outputTypeWrapper.type
              this.constraints.removeCoercionConstraint(coercionConstraint)
              hasProgressBeenMade = true
            }
            else {
              // throw new InternalError(`TODO: output type is specified, but one or more input types differ and are not untyped!`);
            }
          }
        })
      }
    })
    this.constraints.functionCallConstraints.forEach((callConstraint) => {
      if (this.isDebug) { callConstraint.dump() }
    })
    this.constraints.functionOverloadConstraints.forEach((functionOverloadConstraint) => {
      if (this.isDebug) { functionOverloadConstraint.dump() }
    })
    this.constraints.propertyConstraints.forEach((propertyConstraint) => {
      if (this.isDebug) { propertyConstraint.dump() }
    })
    return hasProgressBeenMade
  }
}

function getLeastGeneralCoercedType(a: Type, b: Type) {
  if (a.isEqualTo(b)) {
    return a
  }
  if (a.isEqualTo(untypedType) || b.isEqualTo(untypedType)) {
    return untypedType
  }
  return primitiveTypes.duck // !!!
}
