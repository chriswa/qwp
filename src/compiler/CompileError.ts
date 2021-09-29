import { ErrorWithSourcePos } from "../ErrorWithSourcePos"
import { InternalError } from "../util"

export class CompileError {
  public constructor(
    public errorsWithSourcePos: Array<ErrorWithSourcePos>,
  ) {
    if (errorsWithSourcePos.length < 1) {
      throw new InternalError("CompileError constructor requires at least one errorsWithSourcePos");
    }
  }
}
