import { builtinsById } from "../../builtins/builtins"
import { OpCode } from "../opcodes"
import { VM } from "./VM"

export const opCodeHandlers: Array<(vm: VM) => void> = [];

opCodeHandlers[OpCode.NEGATE] = (vm: VM) => {
  const topValue = vm.currentCallFrame.stackBuffer.popFloat32();
  vm.currentCallFrame.stackBuffer.pushFloat32(-topValue);
};

opCodeHandlers[OpCode.LOGICAL_NOT] = (vm: VM) => {
  const topValue = vm.currentCallFrame.stackBuffer.popBool32();
  vm.currentCallFrame.stackBuffer.pushBool32(topValue);
};

opCodeHandlers[OpCode.ADD] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushFloat32(vm.currentCallFrame.stackBuffer.popFloat32() + vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.SUBTRACT] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushFloat32(vm.currentCallFrame.stackBuffer.popFloat32() - vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.MULTIPLY] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushFloat32(vm.currentCallFrame.stackBuffer.popFloat32() * vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.DIVIDE] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushFloat32(vm.currentCallFrame.stackBuffer.popFloat32() / vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.LT] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushBool32(vm.currentCallFrame.stackBuffer.popFloat32() < vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.LTE] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushBool32(vm.currentCallFrame.stackBuffer.popFloat32() <= vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.GT] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushBool32(vm.currentCallFrame.stackBuffer.popFloat32() > vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.GTE] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushBool32(vm.currentCallFrame.stackBuffer.popFloat32() >= vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.EQ] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushBool32(vm.currentCallFrame.stackBuffer.popFloat32() === vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.NEQ] = (vm: VM) => {
  vm.currentCallFrame.stackBuffer.pushBool32(vm.currentCallFrame.stackBuffer.popFloat32() !== vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.DEREF] = (vm: VM) => {
  const constantIndex = vm.currentCallFrame.stackBuffer.popUint32();
  const dereferencedValue = vm.constantBuffer.peekUint32At(4 * constantIndex);
  vm.currentCallFrame.stackBuffer.pushUint32(dereferencedValue);
};

opCodeHandlers[OpCode.PUSH_CONSTANT] = (vm: VM) => {
  const constantIndex = vm.constantBuffer.readUint32();
  const value = vm.constantBuffer.peekUint32At(4 * constantIndex);
  vm.currentCallFrame.stackBuffer.pushFloat32(value);
};

opCodeHandlers[OpCode.POP_N] = (vm: VM) => {
  const entries = vm.constantBuffer.readUint8();
  vm.currentCallFrame.stackBuffer.discardStackBytes(4 * entries);
};

opCodeHandlers[OpCode.JUMP_FORWARD_IF_POP_FALSE] = (vm: VM) => {
  const jumpDist = vm.constantBuffer.readUint16();
  const topValue = vm.currentCallFrame.stackBuffer.popBool32();
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
  if (vm.currentCallFrame.stackBuffer.peekBool32() === false) {
    vm.currentCallFrame.stackBuffer.popBool32()
  }
  else {
    vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor + jumpDist);
  }
};

opCodeHandlers[OpCode.JUMP_BOOLEAN_AND] = (vm: VM) => { // if peek true, pop, else jump without popping
  const jumpDist = vm.constantBuffer.readUint16();
  if (vm.currentCallFrame.stackBuffer.peekBool32() === true) {
    vm.currentCallFrame.stackBuffer.popBool32()
  }
  else {
    vm.constantBuffer.setByteCursor(vm.constantBuffer.byteCursor + jumpDist);
  }
};

opCodeHandlers[OpCode.ASSIGN_CALLFRAME_VALUE] = (vm: VM) => {
  const callFrameOffsetIndex = vm.constantBuffer.readUint8();
  vm.currentCallFrame.stackBuffer.pokeFloat32At(4 * callFrameOffsetIndex, vm.currentCallFrame.stackBuffer.popFloat32());
};

opCodeHandlers[OpCode.FETCH_CALLFRAME_VALUE] = (vm: VM) => {
  const callFrameOffsetIndex = vm.constantBuffer.readUint8();
  vm.currentCallFrame.stackBuffer.pushFloat32(vm.currentCallFrame.stackBuffer.peekFloat32At(4 * callFrameOffsetIndex));
};

// opCodeHandlers[OpCode.ASSIGN_CALLFRAME_CLOSED_VAR] = (vm: VM) => {
//   const callFrameOffsetIndex = vm.constantBuffer.readUint8();
//   const upvalueConstantIndex = vm.currentCallFrame.stackBuffer.peekUint32At(4 * callFrameOffsetIndex);
//   const variableConstantIndex = vm.ramBuffer.peekUint32At(4 * upvalueConstantIndex);
//   vm.ramBuffer.pokeFloat32At(variableConstantIndex, vm.currentCallFrame.stackBuffer.popFloat32());
// };
// 
// opCodeHandlers[OpCode.FETCH_CALLFRAME_CLOSED_VAR] = (vm: VM) => {
//   const callFrameOffsetIndex = vm.constantBuffer.readUint8();
//   const upvalueConstantIndex = vm.currentCallFrame.stackBuffer.peekUint32At(4 * callFrameOffsetIndex);
//   const variableConstantIndex = vm.ramBuffer.peekUint32At(4 * upvalueConstantIndex);
//   vm.currentCallFrame.stackBuffer.pushFloat32(vm.ramBuffer.peekFloat32At(4 * variableConstantIndex));
// };
// 
// opCodeHandlers[OpCode.CLOSE_VAR] = (vm: VM) => {
//   const valueToMove = vm.currentCallFrame.stackBuffer.popFloat32();
//   const upvalueConstantIndex = throw new Error(`TODO: get the constantIndex of the upvalue which was allocated by DEFINE_FUNCTION`);
//   vm.ramBuffer.pokeUint32At(4 * upvalueConstantIndex, upvalueConstantIndex + 1); // update the upvalue's ptr (at upvalue[0]) to point to the upvalue's storage upvalue[1]
//   vm.ramBuffer.pokeFloat32At(4 * (upvalueConstantIndex + 1), valueToMove) // copy the stack value to the upvalue's storage
// };

opCodeHandlers[OpCode.ASSIGN_PTR] = (vm: VM) => {
  const ptr = vm.currentCallFrame.stackBuffer.popUint32();
  const value = vm.currentCallFrame.stackBuffer.peekFloat32();
  vm.ramBuffer.pokeFloat32At(4 * ptr, value);
};

opCodeHandlers[OpCode.DEFINE_FUNCTION] = (vm: VM) => {
  const functionConstantIndex = vm.constantBuffer.readUint32();
  const closedVarCount = vm.constantBuffer.readUint8();
  const closedVarCallFrameIndexes: Array<number> = [];
  for (let i = 0; i < closedVarCount; i += 1) {
    closedVarCallFrameIndexes.push(vm.constantBuffer.readUint8());
  }
  throw new Error(`TODO: allocate upvalues and set their ptrs to the stack[!]; create closure object on heap and push its heap index onto the stack`);
};

opCodeHandlers[OpCode.CALL] = (vm: VM) => {
  const heapIndex = vm.currentCallFrame.stackBuffer.popUint32();
  throw new Error(`TODO: look in ram at ${heapIndex * 4} for struct describing: arity, closure values to push; add new callframe to vm!`);
};

opCodeHandlers[OpCode.RETURN] = (vm: VM) => {
  throw new Error(`TODO: unimplemented! need to deal with all popping and closing of variables... but without explicit CLOSE_VAR instructions... how?!`);
  ////////////////////////////////////
  // riiiight, i'm not doing this single-pass, so i should have access to a list of all the variables which WILL get closed over... therefore
  // .. i could have the compiler emit a different opcode instead of ASSIGN_CALLFRAME_VALUE, so that the vm can track them!
};

opCodeHandlers[OpCode.PUSH_BUILTIN] = (vm: VM) => {
  const builtInId = vm.constantBuffer.readUint16();
  const builtin = builtinsById.get(builtInId);
  if (builtin === undefined) { throw new Error(`unknown builtin with ID ${builtInId}`) }
  const args: Array<number> = [];
  for (let i = 0; i < builtin.arity; i += 1) {
    args.push(vm.currentCallFrame.stackBuffer.popFloat32());
  }
  builtin.handler((float32: number) => {
    vm.currentCallFrame.stackBuffer.pushFloat32(float32);
  }, args);
};

opCodeHandlers[OpCode.CODESTOP] = (vm: VM) => {
  throw new Error(`CODESTOP opcode should never be reached!`)
};
