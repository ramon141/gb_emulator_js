/*
                                  Setores da memória
----------------------------------------------------------------------------------
|       |       |       |      |         |          |            |       |       |
| BIOS  | ROM 0 | ROM 1 | VRAM | EXT RAM | WORK RAM | INF SPRITE | I/O   | ZRAM  |
| 256BY | 16KB  | 16KB  | 8KB  |   8KB   | 15872BY  |   160BY    | 128BY | 128BY |
|       |       |       |      |         |          |            |       |       |
----------------------------------------------------------------------------------
*/

let MMU = {

  //Flag para indicar se os primeiros 16KB da memória representam a BIOS ou a ROM 0
  inBios: false,

  //Variáveis que representam os setores da memória
  bios: [],
  rom: "",
  vRam: [],
  extRam: [],
  workRam: [],
  zeroRam: [],

  //Carrega de um arquivo de texto os valores para a ROM
  load: function (file) {
    let binaryFile = new BinFileReader(file);
    MMU.rom = binaryFile.readString(binaryFile.getFileSize(), 0);

  },

  /* Lê (e remove) byte de 8 bits de um determinado endereço */
  rb: function (addr) {

    if (addr >= 0x0000 && addr < 0x1000) {//Se está nos primeiros 4KB de memória
      if (MMU.inBios) {
        if (addr < 0x0100) { //Verifica se o endereço aponta para os primeiros 255bytes
          return bios[addr];
        } else if (Z80.registers.pc === 0x0100) { //Se o program counter estiver no final da bios
          MMU.inBios = false;
        }
      }

      return MMU.rom.charCodeAt(addr);//Retorna a ROM, caso os primeiros 255bytes não estejam ocupados com a BIOS

    } else if (addr < 0x4000) { //Se está no endereço 4KB até menor que 16KB (ROM 0)
      return MMU.rom.charCodeAt(addr);

    } else if (addr < 0x8000) { //Se está no endereço 16KB até menor que 32KB (ROM 1)
      return MMU.rom.charCodeAt(addr);

    } else if (addr < 0xA000) { //Se está no endereço 32KB até menor que 40KB (VRAM)

      /*A VRAM possui somente 8KB (8192) posições de memória disponível, logo tenho
      que evitar que o addr seja maior que 8192. Para isso eu subtraio a posição de
      memória de onde inicia a vRam, ou seja, eu subtraio o valor 0x8000*/

      return GPU.vRam[addr - 0x8000];

    } else if (addr < 0xC000) { //Se está no endereço 32KB até menor que 48KB (EXT_RAM)
      return MMU.extRam[addr - 0xA000]; //0xA000 é o primeiro endereço da EXT_RAM

    } else if (addr < 0xFE00) { //Se está no endereço 48KB até menor que 63.5KB (WORK_RAM)
      return MMU.workRam[addr - 0xC000];

    } else if (addr < 0xFF00) { //Se está no endereço 65.5KB até menor que 63.75KB (INF SPRITE)
      return GPU.oam[addr - 0xFE00];

    } else if (addr < 0xFF80) { //Se está no endereço 65.75KB até menor que 63.875KB (I/O)
      if (addr >= 0xFF40)
        return GPU.rb(addr);

    } else if (addr <= 0xFFFF) { //Se está no endereço 65.875KB até 64KB (ZRAM)
      return MMU.zeroRam[addr - 0xFF80];
    }

  },

  /* Lê palavra de 16 bits de um determinado endereço */
  rw: function (addr) {
    return (
      MMU.rb(addr) +
      (MMU.rb(addr + 1) << 8) //Transforma os 8 bits da esquerda para direita, formando uma palavra de 16bits
    );
  },

  /* Grava byte de 8 bits em um determinado endereço */
  wb: function (addr, val) {

    if (addr >= 0x8000 && addr < 0xA000) { //Se está no endereço 32KB até menor que 40KB (VRAM)
      GPU.vRam[addr - 0x8000/*Obtém o endereço base*/] = val;
      GPU.updateTile(addr, val);

    } else if (addr < 0xFF80) { //Se está no endereço 65.75KB até menor que 63.875KB (I/O)
      if (addr >= 0xFF40)
        GPU.wb(addr, val);

    } else if (addr <= 0xFFFF) { //Se está no endereço 65.875KB até 64KB (ZRAM)
      MMU.zeroRam[addr - 0xFF80] = val;
    }

  },

  ww: function (addr, val) { /* Grava uma palavra de 16 bits em um determinado endereço */ }
};