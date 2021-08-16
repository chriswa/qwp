import { Token } from "../Token"
import { TypeAnnotation } from "./TypeAnnotation"

export class FunctionParameter {
  constructor(
    public identifier: Token,
    public typeAnnotation: TypeAnnotation | null,
  ) { }
}
