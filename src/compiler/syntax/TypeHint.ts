import { Token } from "../Token"

export class TypeHint {
  constructor(
    public name: Token,
    public parameters: Array<TypeHint> = [],
  ) {
  }
}
