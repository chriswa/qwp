import { Type } from "../../types"
import { TypeAnnotation } from "../syntax/TypeAnnotation"
import { ResolverScope } from "./ResolverScope"

export const setOfUnresolvedTypes: Set<UnresolvedType> = new Set();

export class UnresolvedType extends Type {
  constructor(
    public typeAnnotation: TypeAnnotation | null,
    public resolverScope: ResolverScope
  ) {
    super();
    setOfUnresolvedTypes.add(this);
  }
  removeFromSetOfUnresolvedTypes() {
    setOfUnresolvedTypes.delete(this);
  }
  toString() {
    return `unresolved(${this.typeAnnotation?.toString()})`;
  }
}
