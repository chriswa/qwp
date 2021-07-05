import { Token } from "../sourcecode/parser/Token"

export class InterpreterRuntimeError extends Error {
  public constructor(
    public token: Token,
    message: string,
  ) {
    super(message);
  }
  public get charPos() {
    return this.token.charPos;
  }
  public get path() {
    return this.token.path;
  }
}
