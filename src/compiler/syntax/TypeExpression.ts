import { Token } from "../Token"

export class TypeExpression {
  constructor(
    public name: Token,
    public parameters: Array<TypeExpression> = [],
  ) {
  }
}
