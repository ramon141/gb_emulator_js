let GPU = {
  //Memória de vídeo
  vRam: [],

  oem: [],

  //Atributo que referencia o elemento canvas do HTML
  canvas: {},

  //Um array re reune o código RGBA da tela (160x144)
  screen: {},

  /**
   * 2 - Scanline (accessing OAM) - Acessar as informações do sprite
   * 3 - Scanline (accessing VRAM) - Acesso da memória de vídeo
   * 0 - Horizontal blank - Tempo que o elétron demora entre um lado e outro, ele desce uma linha
   * 1 - Vertical blank	 - Tempo que o elétron demora de baixo para cima
  */
  mode: 0,

  //Tempo que demora para executar cada uns dos comandos
  modeClock: 0,

  //Linha da varredura (altura = 144)
  line: 0,

  //Conjunto de azuleijos. Cada elemento deste vetor é composto por uma matriz que corresponde a uma azuleijo 8x8
  tiles: [],

  //Background map
  bgMap: [],

  //Variáveis de controle de posição do plano de fundo
  scrY: 0,
  scrX: 0,

  palette: [], //https://gbdev.io/pandocs/Palettes.html

  //Flag para indicar se está atualizando o background
  bgTile: 0,

  //Bits do registrador de LCD
  switchBg: 0, //Bit 0
  switchLCD: 0, //Bit 7

  //Coloca uma tela vazia (em branco) no componente canvas
  reset: function () {
    var canvasElement = document.getElementById('screen');
    GPU.canvas = canvasElement.getContext("2d");

    //Cria a imagem. O tamanho da imagem criada depende do tamanho do canvas
    GPU.screen = GPU.canvas.createImageData(canvasElement.width, canvasElement.height);

    //Adiciona a imagem criada no canvas
    GPU.canvas.putImageData(GPU.screen, 0, 0);

    for (let i = 0; i < 384; i++) {
      //Cria um vetor dentro de outro vetor
      tiles[i] = [];

      for (let j = 0; j < 8; j++) {
        //Cria uma matriz(para cada posição) dentro vetor tiles
        tiles[i][j] = [0, 0, 0, 0, 0, 0, 0, 0];
      }
    }

  },

  /**
   * Formato e informações do endereço
   * |---------------------|
   * |EEET TTTT TTTT YYY0  |
   * |---------------------|
   * 
   * Da esquerda para a direita:
   *  Do 4º bit até o 12º bit - Corresponde ao endereço do tiles
   *  Do 13º bit até o 15º bit - Corresponde a linha do bloco (do tiles).
   *  O zero representa a aceitação somente de valores pares, neste caso o endereço base de 0x8000 é igual a 0x8001
   *   Isso ocorre, pois o tile 0x8000 e o 0x8001 sao necessários para formar 1 bloco 8x8 (devido a possui 4 cores e necessario 2 blocos)
   */

  updateTile: function (addr, val) {
    //Impede que o endereço ultrapasse ou chegue a 8KB
    const baseAddr = addr % 0x2000; //0x2000 = 8KB

    const tile = Math.floor(addr / 16); //Encontra o tile em questão, lembre-se que um tile = 16bytes

    //Isso somente extrai o valor de YYY do endereço, pode ser feito tambem usando (addr >> 1 ) & 7
    const y = (baseAddr / 2) % 8; //Por trabalhar com somente valores pares, nao é necessario do Math.floor

    //Atualiza as colunas da linha y
    for (let x = 7; x >= 0; x++) {//Este for percorre bit-a-bit os valores da linha(y) daquele tile
      //Um tile é composto por dois blocos de 8x8 cada. Isto serve para diferenciar as cores

      //Obtendo xis-ésimo bit do primeiro bloco
      const bitTile1 = GPU.vRam[baseAddr] >> x & 1;
      /*               GPU.vRam[baseAddr] >> x - Move o bit da vez para o bit menos signficativo
                       & 1 - Extrai o bit menos significativo*/

      const bitTile2 = GPU.vRam[baseAddr + 1] >> x & 1;
      //Necessário de dois blocos para formar 1 tile, por isso o +1

      //É dois (na condição do bitTile2) pois a posição do bit é 1, logo 2^1 = 2
      //No bitTile1 a posição é zero, logo 2^0 = 1
      GPU.tiles[tile][y][x] = ((bitTile1 === 1) ? 1 : 0) + ((bitTile2 === 1) ? 2 : 0);
    }

  },

  /*
  Basicamente recria isso aqui

  Mode 2  2_____2_____2_____2_____2_____2___________________2____
  Mode 3  _33____33____33____33____33____33__________________3___
  Mode 0  ___000___000___000___000___000___000________________000
  Mode 1  ____________________________________11111111111111_____
*/
  step: function () {
    GPU.modeClock += Z80.registers.t;

    if (GPU.mode === 2 && GPU.modeClock >= 80) {
      GPU.mode = 3;
      GPU.modeClock = 0;

    } else if (GPU.mode === 3 && GPU.modeClock >= 172) {
      GPU.modeClock = 0;
      GPU.mode = 0;

      //Atualiza a linha
      GPU.renderscan();

    } else if (GPU.mode === 0 && GPU.modeClock >= 204) {//Atualização horizontal. Atualiza a altura
      GPU.modeClock = 0;
      GPU.line++; //Adiciona uma linha na "varredura"

      if (GPU.line === 143) {//Ultima linha - https://gbdev.io/pandocs/Tile_Maps.html
        GPU.mode = 1;
        GPU.canvas.putImageData(GPU.screen, 0, 0);

      } else {
        GPU.mode = 2;
      }

    } else if (GPU.mode === 1 && GPU.modeClock >= 456) { //https://gbdev.io/pandocs/Tile_Maps.html
      GPU.modeClock = 0;
      GPU.line++; //Adiciona uma linha na "varredura"

      if (GPU.line > 153) {
        GPU.mode = 2;
        GPU.line = 0;
      }

    }
  },

  //Atualiza o canvas
  renderscan: function () {
    //Obtém a linha do tile que está atualizando (altura relativa ao tile)
    let y = (GPU.line + GPU.scrY) & 7; //Nesse caso &7 é diferente de %8, pois pode ocorrer valores negativos

    let x = (GPU.scrX) & 7;

    //Seleciona o mapa de bloco 1 (que inicia em 9800) e bloco 2 (que inicia em 9C00)
    let mapOffs = GPU.bgMap ? 0x1C00 : 0x1800;
    mapOffs += ((GPU.line + GPU.scrY) & 255) >> 3;

    //Descobre o bloco que a coluna está
    var lineOffs = (GPU.scrX >> 3);

    //Início da posição da representação de cores do canvas(tag html)
    let canvasOffs = GPU.line/*Altura absoluta da linha atual*/ * 160/*Largura do GB*/ * 4/*RGBA - Tem relação com o createImageData*/;

    var color;

    //Seleciona um tile (0-383)
    var tile = GPU.vRam[mapOffs + lineOffs];

    //Se estiver atualizando o background, muda o endereço para representar o bloco 2
    if (GPU.bgTile === 1 && tile < 128/*Se for maior ocorre estouro na memória*/)
      tile += 256;

    for (let i = 0; i < 160; i++) {//Atualização vertical

      color = GPU.pallet[GPU.tiles[tile][y][x]];

      //Atribui a cor no canvas
      GPU.screen.data[canvasOffs + 0] = color[0];
      GPU.screen.data[canvasOffs + 1] = color[1];
      GPU.screen.data[canvasOffs + 2] = color[2];
      GPU.screen.data[canvasOffs + 3] = color[3];

      //Pula para o proximo pixel do canvas
      canvasOffs += 4;

      //Pula para a próxima coluna
      x++;

      //Quando todos os pixels desta linha termina, devemos pular para a próxima liha
      if (x === 8) {
        lineOffs = (lineOffs + 1) & 31;
        tile = GPU.vRam[mapOffs + lineOffs] //Pula de linha
        if (GPU.bgTile === 1 && tile < 128/*Se for maior ocorre estouro na memória*/)
          tile += 256;
        x = 0; //Volta para o começo da linha
      }

    }



  },

  //Faz o controle de registradores da GPU
  rb: function (addr) {

    if (addr === 0xFF40) {//Registrador do LCD https://gbdev.io/pandocs/LCDC.html
      return (GPU.switchBg ? 0x01 : 0x00) | //Mescla os bits (poderia usar o + também NESTE caso)
        (GPU.bgMap ? 0x08 : 0x00) |
        (GPU.bgTile ? 0x10 : 0x00) |
        (GPU.switchLCD ? 0x80 : 0x00);

    } else if (addr === 0xFF42) { //Scroll Y - https://gbdev.io/pandocs/Scrolling.html
      return GPU.scrY;

    } else if (addr === 0xFF43) { //Scroll X - https://gbdev.io/pandocs/Scrolling.html
      return GPU.scrX;

    } else if (addr === 0xFF44) { //Scanline
      return GPU.line;

    }
  },

  wb: function (addr, val) {

    if (addr === 0xFF40) {//Registrador do LCD https://gbdev.io/pandocs/LCDC.html
      GPU.switchBg = val & 0x01 ? 1 : 0;
      GPU.bgMap = val & 0x08 ? 1 : 0;
      GPU.bgTile = val & 0x10 ? 1 : 0;
      GPU.switchLCD = val & 0x80 ? 1 : 0;

    } else if (addr === 0xFF42) { //Scroll Y - https://gbdev.io/pandocs/Scrolling.html
      GPU.scrY = val;

    } else if (addr === 0xFF43) { //Scroll X - https://gbdev.io/pandocs/Scrolling.html
      GPU.scrX = val;

    } else if (addr === 0xFF47) { //Paleta de cores que seguem a regra do GB 0 -> transparente, 3 -> preto, etc...
      const COLORS = [[255, 255, 255, 255], [192, 192, 192, 255], [96, 96, 96, 255], [0, 0, 0, 255]];

      //Obtém o bit 0 e 1
      const bit0 = (val & 0x01); //0x01 = 0000 0001
      const bit1 = (val & 0x02); //0x02 = 0000 0010
      GPU.palette[0] = COLORS[bit0 + bit1];

      //Obtém o bit 2 e 3
      const bit2 = (val & 0x04) >> 2; //0x01 = 0000 0100
      const bit3 = (val & 0x08) >> 2; //0x02 = 0000 1000
      GPU.palette[1] = COLORS[bit2 + bit3];

      //Obtém o bit 4 e 5
      const bit4 = (val & 0x10) >> 4; //0x01 = 0001 0000
      const bit5 = (val & 0x20) >> 4; //0x02 = 0010 0000
      GPU.palette[2] = COLORS[bit4 + bit5];

      //Obtém o bit 6 e 7
      const bit6 = (val & 0x40) >> 6; //0x01 = 0100 0000
      const bit7 = (val & 0x80) >> 6; //0x02 = 1000 0000
      GPU.palette[3] = COLORS[bit6 + bit7];
    }

  },

}