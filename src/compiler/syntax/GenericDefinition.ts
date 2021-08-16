import { Token } from "../Token"

export class GenericDefinition {
  constructor(
    public name: Token, // TODO: extends, etc.
    public parameters: Array<GenericDefinition> = [],
  ) {
  }
}
