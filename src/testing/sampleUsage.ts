import { registerBuiltinOverload } from '../builtins/builtins'
import { createInterpreter } from '../interpreter/Interpreter'
import { primitiveTypes } from '../types/types'

// const heading = 0
registerBuiltinOverload('querySensor', [ primitiveTypes.uint32 ], primitiveTypes.float32, 1, (_args) => {
  const result = Math.random() < 0.5 ? 0 : 1
  console.log(`sensor result returning ${result}`)
  return result
})
registerBuiltinOverload('turn', [ primitiveTypes.uint32 ], primitiveTypes.void, 1, ([ direction ]) => {
  console.log(`turning ${direction}`)
})
registerBuiltinOverload('move', [], primitiveTypes.void, 1, (_args) => {
  console.log('moving!')
})

const path = 'SAMPLE PATH'
const source = `
const sensorResult = querySensor();
if (sensorResult == 0) {
  move(1);
}
else {
  turn(1);
}
`.trim()

// const source = fs.readFileSync(path, "utf8")
const isDebug = false
const interpreter = createInterpreter(path, source, isDebug)
const remainingBudget = interpreter.runUntilBudgetExhausted(100)
console.log(`remainingBudget: ${remainingBudget}`)

// while (!interpreter.isHalted()) {
//   interpreter.runOneStep()
// }

