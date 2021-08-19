import { FunctionType, primitiveTypes } from "../types"
import { Builtin, builtinsById } from "../builtins/builtins"
import { OpCode } from "../bytecode/opcodes"
import { VM } from "./VM"

export const opCodeHandlers: Array<(vm: VM) => void> = [];

opCodeHandlers[OpCode.NEGATE] = (vm: VM) => {
  const topValue = vm.ramBuffer.popFloat32();
  vm.ramBuffer.pushFloat32(-topValue);
};

opCodeHandlers[OpCode.LOGICAL_NOT] = (vm: VM) => {
  const topValue = vm.ramBuffer.popBool32();
  vm.ramBuffer.pushBool32(topValue);
};

opCodeHandlers[OpCode.ADD] = (vm: VM) => {
  vm.ramBuffer.pushFloat32(vm.ramBuffer.popFloat32() + vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.SUBTRACT] = (vm: VM) => {
  vm.ramBuffer.pushFloat32(vm.ramBuffer.popFloat32() - vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.MULTIPLY] = (vm: VM) => {
  vm.ramBuffer.pushFloat32(vm.ramBuffer.popFloat32() * vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.DIVIDE] = (vm: VM) => {
  vm.ramBuffer.pushFloat32(vm.ramBuffer.popFloat32() / vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.LT] = (vm: VM) => {
  vm.ramBuffer.pushBool32(vm.ramBuffer.popFloat32() < vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.LTE] = (vm: VM) => {
  vm.ramBuffer.pushBool32(vm.ramBuffer.popFloat32() <= vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.GT] = (vm: VM) => {
  vm.ramBuffer.pushBool32(vm.ramBuffer.popFloat32() > vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.GTE] = (vm: VM) => {
  vm.ramBuffer.pushBool32(vm.ramBuffer.popFloat32() >= vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.EQ] = (vm: VM) => {
  vm.ramBuffer.pushBool32(vm.ramBuffer.popFloat32() === vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.NEQ] = (vm: VM) => {
  vm.ramBuffer.pushBool32(vm.ramBuffer.popFloat32() !== vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.PUSH_CONSTANT] = (vm: VM) => {
  const constantIndex = vm.constantBuffer.readUint32();
  const value = vm.constantBuffer.peekUint32At(4 * constantIndex);
  vm.ramBuffer.pushUint32(value);
};

opCodeHandlers[OpCode.JUMP_FORWARD_IF_POP_FALSE] = (vm: VM) => {
  const jumpDist = vm.constantBuffer.readUint16();
  const topValue = vm.ramBuffer.popBool32();
  if (topValue) {
    vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor + jumpDist);
  }
};

opCodeHandlers[OpCode.JUMP_FORWARD] = (vm: VM) => {
  const jumpDist = vm.constantBuffer.readUint16();
  vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor + jumpDist);
};

opCodeHandlers[OpCode.JUMP_BACKWARD] = (vm: VM) => {
  const jumpDist = vm.constantBuffer.readUint16();
  vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor - jumpDist);
};

opCodeHandlers[OpCode.JUMP_BOOLEAN_OR] = (vm: VM) => { // if peek false, pop, else jump without popping
  const jumpDist = vm.constantBuffer.readUint16();
  if (vm.ramBuffer.peekBehindBool32() === false) {
    vm.ramBuffer.popBool32()
  }
  else {
    vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor + jumpDist);
  }
};

opCodeHandlers[OpCode.JUMP_BOOLEAN_AND] = (vm: VM) => { // if peek true, pop, else jump without popping
  const jumpDist = vm.constantBuffer.readUint16();
  if (vm.ramBuffer.peekBehindBool32() === true) {
    vm.ramBuffer.popBool32()
  }
  else {
    vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor + jumpDist);
  }
};

opCodeHandlers[OpCode.ASSIGN_CALLFRAME_VALUE] = (vm: VM) => {
  const callFrameOffsetIndex = vm.constantBuffer.readUint8();
  vm.ramBuffer.pokeFloat32At(4 * (vm.callFrameIndex + callFrameOffsetIndex), vm.ramBuffer.popFloat32());
};

opCodeHandlers[OpCode.FETCH_CALLFRAME_VALUE] = (vm: VM) => {
  const callFrameOffsetIndex = vm.constantBuffer.readUint8();
  vm.ramBuffer.pushFloat32(vm.ramBuffer.peekFloat32At(4 * (vm.callFrameIndex + callFrameOffsetIndex)));
};

opCodeHandlers[OpCode.ASSIGN_PTR] = (vm: VM) => {
  const ptr = vm.ramBuffer.popUint32();
  const value = vm.ramBuffer.peekBehindFloat32();
  // vm.ramBuffer.pokeFloat32At(4 * ptr, value);
  vm.heap.assignNumber(ptr, value);
};

opCodeHandlers[OpCode.DEREF] = (vm: VM) => {
  const heapIndex = vm.ramBuffer.popUint32();
  // const dereferencedValue = vm.constantBuffer.peekUint32At(4 * heapIndex);
  const dereferencedValue = vm.heap.fetchNumber(heapIndex);
  vm.ramBuffer.pushUint32(dereferencedValue); // should this be uint32?
};

opCodeHandlers[OpCode.ALLOC_SCALAR] = (vm: VM) => {
  const value = vm.ramBuffer.popUint32();
  const ptr = vm.heap.allocNumber(value);
  vm.ramBuffer.pushUint32(ptr);
};

opCodeHandlers[OpCode.PROMOTE_PARAM_TO_HEAP] = (vm: VM) => {
  const callFrameOffsetIndex = vm.constantBuffer.readUint8();
  const value = vm.ramBuffer.peekUint32At(4 * (vm.callFrameIndex + callFrameOffsetIndex));
  const ptr = vm.heap.allocNumber(value);
  vm.ramBuffer.pokeUint32At(4 * (vm.callFrameIndex + callFrameOffsetIndex), ptr);
};

opCodeHandlers[OpCode.DEFINE_FUNCTION] = (vm: VM) => {
  const functionConstantIndex = vm.constantBuffer.readUint32();
  const closedVarCount = vm.constantBuffer.readUint8();
  const closedValues: Array<number> = [];
  for (let i = 0; i < closedVarCount; i += 1) {
    const localIndex = vm.constantBuffer.readUint8();
    closedValues.push(vm.ramBuffer.peekUint32At(4 * (vm.callFrameIndex + localIndex)));
  }
  const closurePtr = vm.heap.allocClosure(functionConstantIndex, closedValues);
  vm.ramBuffer.pushUint32(closurePtr);
};

opCodeHandlers[OpCode.POP_N] = (vm: VM) => {
  const entries = vm.constantBuffer.readUint8();
  vm.ramBuffer.discardStackBytes(4 * entries);
};

opCodeHandlers[OpCode.CALL] = (vm: VM) => {
  const argumentCount = vm.constantBuffer.readUint8()
  const closureHeapIndex = vm.ramBuffer.popUint32()

  const builtin = builtinsById.get(closureHeapIndex)
  if (builtin !== undefined) {
    callBuiltin(vm, builtin, argumentCount)
  }
  else {
    callClosure(vm, closureHeapIndex, argumentCount)
  }
}
function callBuiltin(vm: VM, builtin: Builtin, argumentCount: number) {
  const builtinFunctionType = builtin.type as FunctionType;
  if (argumentCount !== builtinFunctionType.argumentTypes.length) { throw new Error(`incorrect argument count for builtin`) }
  const builtinArgs: Array<number> = [];
  for (let i = argumentCount - 1; i >= 0; i -= 1) {
    const argType = builtinFunctionType.argumentTypes[i];
    if (argType === primitiveTypes.uint32) {
      builtinArgs.unshift(vm.ramBuffer.popUint32()); // unshift to avoid reversing the list
    }
    else if (argType === primitiveTypes.float32) {
      builtinArgs.unshift(vm.ramBuffer.popFloat32()); // unshift to avoid reversing the list
    }
    else {
      throw new Error(`callBuiltin has no logic for this builtin argument type`);
    }
  }
  const retval = builtin.handler(builtinArgs);
  if (builtinFunctionType.returnType !== primitiveTypes.void) {
    const returnType = builtinFunctionType.returnType;
    if (returnType === primitiveTypes.uint32) {
      vm.ramBuffer.pushUint32(retval);
    }
    else if (returnType === primitiveTypes.float32) {
      vm.ramBuffer.pushFloat32(retval);
    }
    else {
      throw new Error(`callBuiltin has no logic for this builtin return value type`);
    }
  }
}
function callClosure(vm: VM, closureHeapIndex: number, argumentCount: number) {
  const closure = vm.heap.fetchClosure(closureHeapIndex);
  const stackTop = vm.ramBuffer.byteCursor / 4;
  const callFrameJumpSize = stackTop - argumentCount - vm.callFrameIndex;
  // console.log(`callFrameJumpSize = ${callFrameJumpSize}`);
  const returnBytePosition = vm.constantBuffer.byteCursor;
  for (let i = 0; i < closure.closureValueCount; i += 1) {
    vm.ramBuffer.pushUint32(closure.closureValues[i]);
  }
  vm.ramBuffer.pushUint32(returnBytePosition);
  vm.ramBuffer.pushUint32(callFrameJumpSize);
  
  vm.constantBuffer.setByteCursor(4 * closure.functionIndex); // jump
  vm.callFrameIndex += callFrameJumpSize;

  vm.returnInfoOffset = argumentCount + closure.closureValueCount;
};

opCodeHandlers[OpCode.RETURN] = (vm: VM) => {
  // console.log(`returnInfoOffset = ${vm.returnInfoOffset}`);
  const returnBytePosition = vm.ramBuffer.peekUint32At(4 * (vm.callFrameIndex + vm.returnInfoOffset + 0));
  const callFrameJumpSize = vm.ramBuffer.peekUint32At(4 * (vm.callFrameIndex + vm.returnInfoOffset + 1));
  const retval = vm.ramBuffer.peekUint32At(4 * (vm.callFrameIndex + vm.returnInfoOffset + 2));

  vm.constantBuffer.setByteCursor(returnBytePosition);
  vm.ramBuffer.setByteCursor(4 * vm.callFrameIndex); // discard stack from function call (including args, closed vars, returnBytePosition, and callFrameJumpSize)
  vm.callFrameIndex -= callFrameJumpSize;
  vm.ramBuffer.pushUint32(retval);
};

opCodeHandlers[OpCode.PUSH_BUILTIN] = (vm: VM) => {
  const builtInId = vm.constantBuffer.readUint16();
  vm.ramBuffer.pushUint32(builtInId);
};

opCodeHandlers[OpCode.CODESTOP] = (vm: VM) => {
  vm.isHalted = true;
  if (vm.callFrameIndex > 0) {
    throw new Error(`CODESTOP opcode reached while executing a function!`);
  }
};
