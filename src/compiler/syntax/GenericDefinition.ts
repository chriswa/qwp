import { Token } from '../Token'

export class GenericDefinition {
  constructor(
    public name: Token, // TODO: "X extends Y", "A | B", etc.
    public parameters: Array<GenericDefinition> = [],
  ) {
  }
}
