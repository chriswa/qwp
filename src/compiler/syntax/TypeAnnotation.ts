import { Token } from "../Token"

export class TypeAnnotation {
  constructor(
    public name: Token,
    public parameters: Array<TypeAnnotation> = [],
  ) {
  }
  public toString() {
    let str = this.name.lexeme;
    if (this.parameters.length > 0) {
      str += '<' + this.parameters.map(parameter => parameter.toString()).join(', ') + '>';
    }
    return str;
  }
}
