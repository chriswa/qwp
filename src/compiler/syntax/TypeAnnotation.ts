import { Token } from "../Token"

export class TypeAnnotation {
  constructor(
    public name: Token,
    public parameters: Array<TypeAnnotation> = [],
  ) {
  }
}
