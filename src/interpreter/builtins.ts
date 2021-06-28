import { BuiltInFunctionInterpreterValue, NullInterpreterValue } from "./InterpreterValue"

export const INTERPRETER_BUILTINS = {
  "print": new BuiltInFunctionInterpreterValue(1, (interpreter, arg0) => {
    interpreter.appendOutput(arg0.stringify());
    return NullInterpreterValue.INSTANCE;
  }),
  "println": new BuiltInFunctionInterpreterValue(1, (interpreter, arg0) => {
    interpreter.appendOutput(arg0.stringify() + "\n");
    return NullInterpreterValue.INSTANCE;
  }),
};
