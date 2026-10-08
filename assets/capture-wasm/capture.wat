(module
 (type $0 (func (param i32 i32)))
 (type $1 (func (param i32)))
 (type $2 (func (param i32) (result i32)))
 (type $3 (func))
 (type $4 (func (param f64) (result f64)))
 (type $5 (func (param i32 i32 i32 i32 i32 i32 f64 f64 f64 f64 f64 f64 f64 f64 f64)))
 (type $6 (func (param i32 i32 i32 i32 i32 i32 f64 f64 f64)))
 (type $7 (func (param i32 i32 i32 i32 i32 i32)))
 (type $8 (func (param i32 i32 i32 i32)))
 (type $9 (func (param i32 i32) (result i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $~lib/native/ASC_SHRINK_LEVEL i32 (i32.const 0))
 (global $~lib/rt/stub/startOffset (mut i32) (i32.const 0))
 (global $~lib/rt/stub/offset (mut i32) (i32.const 0))
 (global $~lib/rt/__rtti_base i32 (i32.const 144))
 (global $~lib/memory/__heap_base i32 (i32.const 164))
 (memory $0 1)
 (data $0 (i32.const 12) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00(\00\00\00A\00l\00l\00o\00c\00a\00t\00i\00o\00n\00 \00t\00o\00o\00 \00l\00a\00r\00g\00e\00\00\00\00\00")
 (data $1 (i32.const 76) "<\00\00\00\00\00\00\00\00\00\00\00\02\00\00\00\1e\00\00\00~\00l\00i\00b\00/\00r\00t\00/\00s\00t\00u\00b\00.\00t\00s\00\00\00\00\00\00\00\00\00\00\00\00\00\00\00")
 (data $2 (i32.const 144) "\04\00\00\00 \00\00\00 \00\00\00 \00\00\00\00\00\00\00")
 (table $0 1 1 funcref)
 (elem $0 (i32.const 1))
 (export "warpPerspective" (func $assembly/capture/warpPerspective))
 (export "applyFlatField" (func $assembly/capture/applyFlatField))
 (export "dilateFill" (func $assembly/capture/dilateFill))
 (export "__new" (func $~lib/rt/stub/__new))
 (export "__pin" (func $~lib/rt/stub/__pin))
 (export "__unpin" (func $~lib/rt/stub/__unpin))
 (export "__collect" (func $~lib/rt/stub/__collect))
 (export "__rtti_base" (global $~lib/rt/__rtti_base))
 (export "memory" (memory $0))
 (start $~start)
 (func $~lib/math/NativeMath.round (param $0 f64) (result f64)
  (local $1 f64)
  i32.const 0
  i32.const 0
  i32.gt_s
  drop
  local.get $0
  f64.ceil
  local.set $1
  local.get $1
  local.get $1
  f64.const 1
  f64.sub
  local.get $1
  f64.const 0.5
  f64.sub
  local.get $0
  f64.le
  select
  return
 )
 (func $assembly/capture/warpPerspective (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 f64) (param $7 f64) (param $8 f64) (param $9 f64) (param $10 f64) (param $11 f64) (param $12 f64) (param $13 f64) (param $14 f64)
  (local $15 i32)
  (local $16 i32)
  (local $17 f64)
  (local $18 f64)
  (local $19 f64)
  (local $20 f64)
  (local $21 f64)
  (local $22 i32)
  (local $23 i32)
  (local $24 i32)
  (local $25 i32)
  i32.const 0
  local.set $15
  loop $for-loop|0
   local.get $15
   local.get $5
   i32.lt_s
   if
    i32.const 0
    local.set $16
    loop $for-loop|1
     local.get $16
     local.get $4
     i32.lt_s
     if
      local.get $16
      f64.convert_i32_s
      local.set $17
      local.get $15
      f64.convert_i32_s
      local.set $18
      local.get $12
      local.get $17
      f64.mul
      local.get $13
      local.get $18
      f64.mul
      f64.add
      local.get $14
      f64.add
      local.set $19
      local.get $6
      local.get $17
      f64.mul
      local.get $7
      local.get $18
      f64.mul
      f64.add
      local.get $8
      f64.add
      local.get $19
      f64.div
      local.set $20
      local.get $9
      local.get $17
      f64.mul
      local.get $10
      local.get $18
      f64.mul
      f64.add
      local.get $11
      f64.add
      local.get $19
      f64.div
      local.set $21
      local.get $20
      call $~lib/math/NativeMath.round
      i32.trunc_sat_f64_s
      local.set $22
      local.get $21
      call $~lib/math/NativeMath.round
      i32.trunc_sat_f64_s
      local.set $23
      local.get $15
      local.get $4
      i32.mul
      local.get $16
      i32.add
      i32.const 4
      i32.mul
      local.set $24
      local.get $22
      i32.const 0
      i32.ge_s
      if (result i32)
       local.get $23
       i32.const 0
       i32.ge_s
      else
       i32.const 0
      end
      if (result i32)
       local.get $22
       local.get $1
       i32.lt_s
      else
       i32.const 0
      end
      if (result i32)
       local.get $23
       local.get $2
       i32.lt_s
      else
       i32.const 0
      end
      if
       local.get $23
       local.get $1
       i32.mul
       local.get $22
       i32.add
       i32.const 4
       i32.mul
       local.set $25
       local.get $3
       local.get $24
       i32.add
       local.get $0
       local.get $25
       i32.add
       i32.load8_u
       i32.store8
       local.get $3
       local.get $24
       i32.add
       i32.const 1
       i32.add
       local.get $0
       local.get $25
       i32.add
       i32.const 1
       i32.add
       i32.load8_u
       i32.store8
       local.get $3
       local.get $24
       i32.add
       i32.const 2
       i32.add
       local.get $0
       local.get $25
       i32.add
       i32.const 2
       i32.add
       i32.load8_u
       i32.store8
      else
       local.get $3
       local.get $24
       i32.add
       i32.const 255
       i32.store8
       local.get $3
       local.get $24
       i32.add
       i32.const 1
       i32.add
       i32.const 255
       i32.store8
       local.get $3
       local.get $24
       i32.add
       i32.const 2
       i32.add
       i32.const 255
       i32.store8
      end
      local.get $3
      local.get $24
      i32.add
      i32.const 3
      i32.add
      i32.const 255
      i32.store8
      local.get $16
      i32.const 1
      i32.add
      local.set $16
      br $for-loop|1
     end
    end
    local.get $15
    i32.const 1
    i32.add
    local.set $15
    br $for-loop|0
   end
  end
 )
 (func $assembly/capture/applyFlatField (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32) (param $6 f64) (param $7 f64) (param $8 f64)
  (local $9 i32)
  (local $10 f64)
  (local $11 f64)
  (local $12 f64)
  (local $13 f64)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 f64)
  (local $19 i32)
  (local $20 f64)
  (local $21 f64)
  (local $22 f64)
  (local $23 f64)
  (local $24 i32)
  (local $25 i32)
  (local $26 i32)
  (local $27 i32)
  (local $28 f64)
  (local $29 i32)
  (local $30 i32)
  (local $31 f64)
  (local $32 f64)
  (local $33 f64)
  (local $34 f64)
  (local $35 f64)
  (local $36 f64)
  (local $37 f64)
  (local $38 i32)
  (local $39 f64)
  i32.const 0
  local.set $9
  loop $for-loop|0
   local.get $9
   local.get $2
   i32.lt_s
   if
    local.get $9
    f64.convert_i32_s
    local.get $6
    f64.div
    local.set $10
    local.get $10
    local.get $8
    f64.div
    f64.const 0.5
    f64.sub
    local.set $11
    local.get $11
    f64.const 0
    f64.lt
    if
     f64.const 0
     local.set $11
    end
    local.get $5
    i32.const 1
    i32.sub
    f64.convert_i32_s
    f64.const 0.001
    f64.sub
    local.set $12
    local.get $11
    local.get $12
    f64.gt
    if
     local.get $12
     local.set $11
    end
    block $~lib/math/NativeMath.floor|inlined.0 (result f64)
     local.get $11
     local.set $13
     local.get $13
     f64.floor
     br $~lib/math/NativeMath.floor|inlined.0
    end
    i32.trunc_sat_f64_s
    local.set $14
    local.get $5
    i32.const 1
    i32.sub
    local.tee $15
    local.get $14
    i32.const 1
    i32.add
    local.tee $16
    local.get $15
    local.get $16
    i32.lt_s
    select
    local.set $17
    local.get $11
    local.get $14
    f64.convert_i32_s
    f64.sub
    local.set $18
    i32.const 0
    local.set $19
    loop $for-loop|1
     local.get $19
     local.get $1
     i32.lt_s
     if
      local.get $19
      f64.convert_i32_s
      local.get $6
      f64.div
      local.set $20
      local.get $20
      local.get $7
      f64.div
      f64.const 0.5
      f64.sub
      local.set $21
      local.get $21
      f64.const 0
      f64.lt
      if
       f64.const 0
       local.set $21
      end
      local.get $4
      i32.const 1
      i32.sub
      f64.convert_i32_s
      f64.const 0.001
      f64.sub
      local.set $22
      local.get $21
      local.get $22
      f64.gt
      if
       local.get $22
       local.set $21
      end
      block $~lib/math/NativeMath.floor|inlined.1 (result f64)
       local.get $21
       local.set $23
       local.get $23
       f64.floor
       br $~lib/math/NativeMath.floor|inlined.1
      end
      i32.trunc_sat_f64_s
      local.set $24
      local.get $4
      i32.const 1
      i32.sub
      local.tee $25
      local.get $24
      i32.const 1
      i32.add
      local.tee $26
      local.get $25
      local.get $26
      i32.lt_s
      select
      local.set $27
      local.get $21
      local.get $24
      f64.convert_i32_s
      f64.sub
      local.set $28
      local.get $9
      local.get $1
      i32.mul
      local.get $19
      i32.add
      i32.const 4
      i32.mul
      local.set $29
      i32.const 0
      local.set $30
      loop $for-loop|2
       local.get $30
       i32.const 3
       i32.lt_s
       if
        local.get $3
        local.get $14
        local.get $4
        i32.mul
        local.get $24
        i32.add
        i32.const 3
        i32.mul
        local.get $30
        i32.add
        i32.const 8
        i32.mul
        i32.add
        f64.load
        local.set $31
        local.get $3
        local.get $14
        local.get $4
        i32.mul
        local.get $27
        i32.add
        i32.const 3
        i32.mul
        local.get $30
        i32.add
        i32.const 8
        i32.mul
        i32.add
        f64.load
        local.set $32
        local.get $3
        local.get $17
        local.get $4
        i32.mul
        local.get $24
        i32.add
        i32.const 3
        i32.mul
        local.get $30
        i32.add
        i32.const 8
        i32.mul
        i32.add
        f64.load
        local.set $33
        local.get $3
        local.get $17
        local.get $4
        i32.mul
        local.get $27
        i32.add
        i32.const 3
        i32.mul
        local.get $30
        i32.add
        i32.const 8
        i32.mul
        i32.add
        f64.load
        local.set $34
        local.get $31
        local.get $32
        local.get $31
        f64.sub
        local.get $28
        f64.mul
        f64.add
        local.set $35
        local.get $33
        local.get $34
        local.get $33
        f64.sub
        local.get $28
        f64.mul
        f64.add
        local.set $36
        local.get $35
        local.get $36
        local.get $35
        f64.sub
        local.get $18
        f64.mul
        f64.add
        local.set $37
        local.get $0
        local.get $29
        i32.add
        local.get $30
        i32.add
        local.set $38
        local.get $38
        i32.load8_u
        f64.convert_i32_u
        local.get $37
        f64.mul
        local.set $39
        local.get $39
        f64.const 255
        f64.gt
        if
         f64.const 255
         local.set $39
        end
        local.get $38
        local.get $39
        i32.trunc_sat_f64_u
        i32.store8
        local.get $30
        i32.const 1
        i32.add
        local.set $30
        br $for-loop|2
       end
      end
      local.get $19
      i32.const 1
      i32.add
      local.set $19
      br $for-loop|1
     end
    end
    local.get $9
    i32.const 1
    i32.add
    local.set $9
    br $for-loop|0
   end
  end
 )
 (func $assembly/capture/dilateFill (param $0 i32) (param $1 i32) (param $2 i32) (param $3 i32) (param $4 i32) (param $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 i32)
  (local $9 i32)
  (local $10 i32)
  (local $11 i32)
  (local $12 i32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 i32)
  (local $18 i32)
  (local $19 i32)
  (local $20 i32)
  local.get $3
  local.get $4
  i32.mul
  local.set $6
  i32.const 0
  local.set $7
  block $for-break0
   loop $for-loop|0
    local.get $7
    local.get $5
    i32.lt_s
    if
     local.get $2
     local.get $1
     local.get $6
     memory.copy
     i32.const 0
     local.set $8
     i32.const 0
     local.set $9
     loop $for-loop|1
      local.get $9
      local.get $4
      i32.lt_s
      if
       i32.const 0
       local.set $10
       loop $for-loop|2
        local.get $10
        local.get $3
        i32.lt_s
        if
         block $for-continue|2
          local.get $9
          local.get $3
          i32.mul
          local.get $10
          i32.add
          local.set $11
          local.get $1
          local.get $11
          i32.add
          i32.load8_u
          i32.const 0
          i32.ne
          if
           br $for-continue|2
          end
          i32.const 0
          local.set $12
          i32.const 0
          local.set $13
          i32.const 0
          local.set $14
          i32.const 0
          local.set $15
          local.get $10
          i32.const 0
          i32.gt_s
          if (result i32)
           local.get $1
           local.get $11
           i32.add
           i32.const 1
           i32.sub
           i32.load8_u
           i32.const 0
           i32.ne
          else
           i32.const 0
          end
          if
           local.get $11
           i32.const 1
           i32.sub
           i32.const 4
           i32.mul
           local.set $16
           local.get $12
           local.get $0
           local.get $16
           i32.add
           i32.load8_u
           i32.add
           local.set $12
           local.get $13
           local.get $0
           local.get $16
           i32.add
           i32.const 1
           i32.add
           i32.load8_u
           i32.add
           local.set $13
           local.get $14
           local.get $0
           local.get $16
           i32.add
           i32.const 2
           i32.add
           i32.load8_u
           i32.add
           local.set $14
           local.get $15
           i32.const 1
           i32.add
           local.set $15
          end
          local.get $10
          local.get $3
          i32.const 1
          i32.sub
          i32.lt_s
          if (result i32)
           local.get $1
           local.get $11
           i32.add
           i32.const 1
           i32.add
           i32.load8_u
           i32.const 0
           i32.ne
          else
           i32.const 0
          end
          if
           local.get $11
           i32.const 1
           i32.add
           i32.const 4
           i32.mul
           local.set $17
           local.get $12
           local.get $0
           local.get $17
           i32.add
           i32.load8_u
           i32.add
           local.set $12
           local.get $13
           local.get $0
           local.get $17
           i32.add
           i32.const 1
           i32.add
           i32.load8_u
           i32.add
           local.set $13
           local.get $14
           local.get $0
           local.get $17
           i32.add
           i32.const 2
           i32.add
           i32.load8_u
           i32.add
           local.set $14
           local.get $15
           i32.const 1
           i32.add
           local.set $15
          end
          local.get $9
          i32.const 0
          i32.gt_s
          if (result i32)
           local.get $1
           local.get $11
           i32.add
           local.get $3
           i32.sub
           i32.load8_u
           i32.const 0
           i32.ne
          else
           i32.const 0
          end
          if
           local.get $11
           local.get $3
           i32.sub
           i32.const 4
           i32.mul
           local.set $18
           local.get $12
           local.get $0
           local.get $18
           i32.add
           i32.load8_u
           i32.add
           local.set $12
           local.get $13
           local.get $0
           local.get $18
           i32.add
           i32.const 1
           i32.add
           i32.load8_u
           i32.add
           local.set $13
           local.get $14
           local.get $0
           local.get $18
           i32.add
           i32.const 2
           i32.add
           i32.load8_u
           i32.add
           local.set $14
           local.get $15
           i32.const 1
           i32.add
           local.set $15
          end
          local.get $9
          local.get $4
          i32.const 1
          i32.sub
          i32.lt_s
          if (result i32)
           local.get $1
           local.get $11
           i32.add
           local.get $3
           i32.add
           i32.load8_u
           i32.const 0
           i32.ne
          else
           i32.const 0
          end
          if
           local.get $11
           local.get $3
           i32.add
           i32.const 4
           i32.mul
           local.set $19
           local.get $12
           local.get $0
           local.get $19
           i32.add
           i32.load8_u
           i32.add
           local.set $12
           local.get $13
           local.get $0
           local.get $19
           i32.add
           i32.const 1
           i32.add
           i32.load8_u
           i32.add
           local.set $13
           local.get $14
           local.get $0
           local.get $19
           i32.add
           i32.const 2
           i32.add
           i32.load8_u
           i32.add
           local.set $14
           local.get $15
           i32.const 1
           i32.add
           local.set $15
          end
          local.get $15
          i32.const 0
          i32.gt_s
          if
           local.get $11
           i32.const 4
           i32.mul
           local.set $20
           local.get $0
           local.get $20
           i32.add
           local.get $12
           local.get $15
           i32.div_s
           i32.store8
           local.get $0
           local.get $20
           i32.add
           i32.const 1
           i32.add
           local.get $13
           local.get $15
           i32.div_s
           i32.store8
           local.get $0
           local.get $20
           i32.add
           i32.const 2
           i32.add
           local.get $14
           local.get $15
           i32.div_s
           i32.store8
           local.get $2
           local.get $11
           i32.add
           i32.const 1
           i32.store8
           i32.const 1
           local.set $8
          end
         end
         local.get $10
         i32.const 1
         i32.add
         local.set $10
         br $for-loop|2
        end
       end
       local.get $9
       i32.const 1
       i32.add
       local.set $9
       br $for-loop|1
      end
     end
     local.get $1
     local.get $2
     local.get $6
     memory.copy
     local.get $8
     i32.eqz
     if
      br $for-break0
     end
     local.get $7
     i32.const 1
     i32.add
     local.set $7
     br $for-loop|0
    end
   end
  end
 )
 (func $~lib/rt/stub/maybeGrowMemory (param $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  memory.size
  local.set $1
  local.get $1
  i32.const 16
  i32.shl
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  local.set $2
  local.get $0
  local.get $2
  i32.gt_u
  if
   local.get $0
   local.get $2
   i32.sub
   i32.const 65535
   i32.add
   i32.const 65535
   i32.const -1
   i32.xor
   i32.and
   i32.const 16
   i32.shr_u
   local.set $3
   local.get $1
   local.tee $4
   local.get $3
   local.tee $5
   local.get $4
   local.get $5
   i32.gt_s
   select
   local.set $6
   local.get $6
   memory.grow
   i32.const 0
   i32.lt_s
   if
    local.get $3
    memory.grow
    i32.const 0
    i32.lt_s
    if
     unreachable
    end
   end
  end
  local.get $0
  global.set $~lib/rt/stub/offset
 )
 (func $~lib/rt/common/BLOCK#set:mmInfo (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  i32.store
 )
 (func $~lib/rt/stub/__alloc (param $0 i32) (result i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  local.get $0
  i32.const 1073741820
  i32.gt_u
  if
   i32.const 32
   i32.const 96
   i32.const 33
   i32.const 29
   call $~lib/builtins/abort
   unreachable
  end
  global.get $~lib/rt/stub/offset
  local.set $1
  global.get $~lib/rt/stub/offset
  i32.const 4
  i32.add
  local.set $2
  block $~lib/rt/stub/computeSize|inlined.0 (result i32)
   local.get $0
   local.set $3
   local.get $3
   i32.const 4
   i32.add
   i32.const 15
   i32.add
   i32.const 15
   i32.const -1
   i32.xor
   i32.and
   i32.const 4
   i32.sub
   br $~lib/rt/stub/computeSize|inlined.0
  end
  local.set $4
  local.get $2
  local.get $4
  i32.add
  call $~lib/rt/stub/maybeGrowMemory
  local.get $1
  local.get $4
  call $~lib/rt/common/BLOCK#set:mmInfo
  local.get $2
  return
 )
 (func $~lib/rt/common/OBJECT#set:gcInfo (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  i32.store offset=4
 )
 (func $~lib/rt/common/OBJECT#set:gcInfo2 (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  i32.store offset=8
 )
 (func $~lib/rt/common/OBJECT#set:rtId (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  i32.store offset=12
 )
 (func $~lib/rt/common/OBJECT#set:rtSize (param $0 i32) (param $1 i32)
  local.get $0
  local.get $1
  i32.store offset=16
 )
 (func $~lib/rt/stub/__new (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  local.get $0
  i32.const 1073741804
  i32.gt_u
  if
   i32.const 32
   i32.const 96
   i32.const 86
   i32.const 30
   call $~lib/builtins/abort
   unreachable
  end
  i32.const 16
  local.get $0
  i32.add
  call $~lib/rt/stub/__alloc
  local.set $2
  local.get $2
  i32.const 4
  i32.sub
  local.set $3
  local.get $3
  i32.const 0
  call $~lib/rt/common/OBJECT#set:gcInfo
  local.get $3
  i32.const 0
  call $~lib/rt/common/OBJECT#set:gcInfo2
  local.get $3
  local.get $1
  call $~lib/rt/common/OBJECT#set:rtId
  local.get $3
  local.get $0
  call $~lib/rt/common/OBJECT#set:rtSize
  local.get $2
  i32.const 16
  i32.add
  return
 )
 (func $~lib/rt/stub/__pin (param $0 i32) (result i32)
  local.get $0
  return
 )
 (func $~lib/rt/stub/__unpin (param $0 i32)
 )
 (func $~lib/rt/stub/__collect
 )
 (func $~start
  global.get $~lib/memory/__heap_base
  i32.const 4
  i32.add
  i32.const 15
  i32.add
  i32.const 15
  i32.const -1
  i32.xor
  i32.and
  i32.const 4
  i32.sub
  global.set $~lib/rt/stub/startOffset
  global.get $~lib/rt/stub/startOffset
  global.set $~lib/rt/stub/offset
 )
)
