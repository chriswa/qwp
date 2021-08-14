/*
export class TypeDefinition {
  constructor(
    public typeName: string,
    public targetTypeDef: TypeDefinition,
    public parameters: TypeDefinition,
  ) {
  }
}

export class ClassDefinition extends TypeDefinition {
  public baseClassDef: ClassDefinition | null = null;
  // public methods: Map<string, ???> = new Map();
  // public fields: Map<string, ???> = new Map();
  constructor(
    name: string,
  ) {
    super(name);
  }
}


export const basicTypes: Map<string, TypeDefinition> = new Map();

function addBasicType(typeDef: TypeDefinition) {
  basicTypes.set(typeDef.typeName, typeDef);
}

addBasicType(new TypeDefinition('int'));
addBasicType(new TypeDefinition('float'));
addBasicType(new TypeDefinition('bool'));
*/
