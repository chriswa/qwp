import { BuiltInFunctionValue, NullValue } from "./Value"

export const GLOBAL_BUILTINS = {
  "print": new BuiltInFunctionValue(1, (interpreter, arg0) => {
    interpreter.output += arg0.stringify();
    return NullValue.INSTANCE;
  }),
  "println": new BuiltInFunctionValue(1, (interpreter, arg0) => {
    interpreter.output += arg0.stringify() + "\n";
    return NullValue.INSTANCE;
  }),
};
