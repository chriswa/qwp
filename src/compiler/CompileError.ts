import { ErrorWithSourcePos } from "../ErrorWithSourcePos"

export class CompileError {
  public constructor(
    public errorsWithSourcePos: Array<ErrorWithSourcePos>,
  ) {
    if (errorsWithSourcePos.length < 1) {
      throw new Error("CompileError constructor requires at least one errorsWithSourcePos");
    }
  }
}
