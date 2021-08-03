export enum OpCode {
  NEGATE,
  LOGICAL_NOT,
  ADD,
  SUBTRACT,
  MULTIPLY,
  DIVIDE,
  LT,
  LTE,
  GT,
  GTE,
  EQ,
  NEQ,
  PUSH_CONSTANT,
  JUMP_FORWARD_IF_POP_FALSE,
  JUMP_FORWARD,
  JUMP_BACKWARD,
  JUMP_BOOLEAN_OR,  // if peek false, pop, else jump without popping
  JUMP_BOOLEAN_AND, // if peek true, pop, else jump without popping
  ASSIGN_CALLFRAME_VALUE,
  FETCH_CALLFRAME_VALUE,
  ASSIGN_PTR, // pop ptr, assigns (peeked) value to that location in ram
  DEREF, // pop ptr, then pushes value found at that locaton in ram
  ALLOC_SCALAR, // value = pop stack; allocate single 32-bit, pushing ptr/index onto stack; write value into dest
  PROMOTE_PARAM_TO_HEAP,
  DEFINE_FUNCTION,
  POP_N,
  CALL,
  RETURN,
  PUSH_BUILTIN,
  CODESTOP, // only used by decompiler!
};
