import { TypeWrapper } from './types'

export const allTypeRelationships: Array<TypeRelationship> = []

export class TypeRelationship {
  protected constructor() {
    allTypeRelationships.push(this)
  }
}

export class TypeRelationshipCall extends TypeRelationship {
  public constructor(
    public callee: TypeWrapper,
    public args: Array<TypeWrapper>,
    public ret: TypeWrapper,
  ) {
    super()
  }
}

export class TypeRelationshipCoerce extends TypeRelationship {
  public constructor(
    public source: TypeWrapper,
    public target: TypeWrapper,
  ) {
    super()
  }
}

