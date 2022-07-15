let jsGB = {
  interval: null,

  reset: function () {
    GPU.reset();
    MMU.reset();
    Z80.reset();

    MMU.load('test.gb');
  },

  run: function () {
    if (!jsGB.interval) {
      jsGB.interval = setTimeout(jsGB.frame, 1);
      document.getElementById('run').innerHTML = 'Pause';

    } else {
      clearInterval(jsGB.interval);
    }


  },


  frame: function () {
    /*
    144 - Linhas de varredura
    10 - Linhas de vertical blank
    456 - ciclos de clock
    */
    let frameClock = Z80.clock.t + (144 + 10 * 456);

    do {
      //Obtém o endereço da próxima instrução
      const addressNextInstruction = MMU.rb(Z80.registers.pc++);

      //Mapa das instruções disponíveis
      Z80.map[addressNextInstruction]();

      //Impede que o program counter aponte para valores maiores que 2^16
      Z80.registers.pc = Z80.registers.pc % Math.pow(2, 16);

      //Atualiza os clocks
      Z80.clock.m += Z80.registers.m;
      Z80.clock.t += Z80.registers.t;

      //Função de atualização de tempo da GPU (seguindo as regras da tela LED)
      GPU.step();

    } while (Z80.clock.t < frameClock); //Para depois de renderizar o frame

  }
}