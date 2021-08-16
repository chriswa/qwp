import { Token } from "../Token"
import { TypeHint } from "./TypeHint"

export class FunctionParameter {
  constructor(
    public identifier: Token,
    public typeHint: TypeHint | null,
  ) { }
}
