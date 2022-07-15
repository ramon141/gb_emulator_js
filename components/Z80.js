const Z80 = {

  clock: {
    m: 0, //Ciclo de máquina (fetch-decode-execute)
    t: 0 //Ciclo de clock (4MHz)
  },
  registers: {
    a: 0, //Registrador de uso geral
    b: 0, //Registrador de uso geral
    c: 0, //Registrador de uso geral
    d: 0, //Registrador de uso geral
    e: 0, //Registrador de uso geral
    h: 0, //Registrador de uso geral
    l: 0, //Registrador de uso geral
    f: 0, //Registrador de flag
    pc: 0, //Program Counter
    sp: 0, //Stack Pointer
    m: 0,
    t: 0
  },

  map: [],

  //Restaura os valores iniciais
  reset: function () {
    Z80.registers.a = Z80.registers.b = Z80.registers.c = Z80.registers.d =
      Z80.registers.e = Z80.registers.h = Z80.registers.l = Z80.registers.f =
      Z80.registers.pc = Z80.registers.sp = Z80.registers.m = Z80.registers.t =
      Z80.clock.m = Z80.clock.t = 0;
  },

  //Adicionar o registrador E com A, e colocar o resultado em A. Modificando o registrador de flag
  ADDr_e: function () {
    //Realizando de fato a adição
    Z80.registers.a += Z80.registers.e;

    //Analisando os casos para o registrador de flag
    //Reset registrador de flag
    Z80.registers.f = 0;

    //Flag: Zero
    if (Z80.registers.a === 0) Z80.registers.f += 0x80; //0x80 = 128

    //Flag: Carry
    if (Z80.registers.a > 255) Z80.registers.f += 0x10; //0x80 = 16

    Z80.registers.a = Z80.registers.a % 256; //Impede valores acima de 255

    Z80.registers.m = 1;
    Z80.registers.t = 4;
  },

  CPr_b: function () {
    let tempRegisterA = Z80.registers.a;
    tempRegisterA -= Z80.registers.b;

    //Análises de Flag
    Z80.registers.f = 0x40; //Flag de subtração

    if (i == 0) Z80.registers.f += 0x80; //Flag de Zero

    if (i < 0) Z80.registers.f += 0x10; //Carry

    Z80.registers.m = 1;
    Z80.registers.t = 4;
  },

  NOP: function () {
    Z80.registers.m = 1;
    Z80.registers.t = 4;
  },

  //Adiciona os registradores B e C na pilha (nesta ordem)
  PUSHb_c: function () {
    //Adiciona B na pilha
    Z80.registers.sp--;
    MMU.wb(Z80.registers.sp, Z80.registers.b);

    //Adiciona C na pilha
    Z80.registers.sp--;
    MMU.wb(Z80.registers.sp, Z80.registers.c);

    Z80.registers.m = 3;
    Z80.registers.t = 12;
  },

  //Desempilha os dois valores no topo da pilha e colocar nos registradores L e H (nesta ordem)
  POPh_l: function () {
    //Remove L na pilha
    Z80.registers.sp++;
    Z80.registers.l = MMU.rb(Z80.registers.sp);

    //Remove H na pilha
    Z80.registers.sp++;
    Z80.registers.h = MMU.rb(Z80.registers.sp);

    Z80.registers.m = 3;
    Z80.registers.t = 12;
  },

  //Obtém o endereço da instrução e atribui ao registrador A, avança o program count
  LDAmm: function () {
    const addrInstructionNow = MMW.rw(Z80.registers.pc);
    Z80.registers.a = addrInstructionNow;

    Z80.registers.pc += 2;

    Z80.registers.m = 4;
    Z80.registers.t = 16;
  }
};

