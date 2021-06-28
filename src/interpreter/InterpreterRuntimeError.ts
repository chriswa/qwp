import { Token } from "../sourcecode/parser/Token"

export class InterpreterRuntimeError extends Error {
  public constructor(
    public token: Token,
    message: string,
  ) {
    super(message);
  }
}
