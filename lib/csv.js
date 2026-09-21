// Parser de CSV compartilhado — usado por Moradores e Colaboradores pra
// importar planilha (.csv exportado do Excel/Google Sheets). Sem lib
// externa (evita dependência com vulnerabilidades conhecidas só pra ler
// um arquivo simples — ver histórico do módulo Moradores).

import { parseNumeroBr, parseDataBr } from "@/lib/validacaoPlanilha";

export function normalizarCabecalho(texto) {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function detectarSeparador(primeiraLinha) {
  const contagens = [",", ";", "\t"].map((sep) => ({
    sep,
    n: primeiraLinha.split(sep).length,
  }));
  contagens.sort((a, b) => b.n - a.n);
  return contagens[0].n > 1 ? contagens[0].sep : ",";
}

function parseLinhaCsv(linha, separador) {
  const campos = [];
  let atual = "";
  let dentroAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (dentroAspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') {
        dentroAspas = false;
      } else {
        atual += c;
      }
    } else if (c === '"') {
      dentroAspas = true;
    } else if (c === separador) {
      campos.push(atual);
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

// `mapaCampos`: { campo: [variações de cabeçalho aceitas, sem acento e minúsculo] }
// `obrigatorios`: campos que precisam existir na planilha E estar preenchidos em cada linha.
// `tipos` (opcional): { campo: "numero" | "data" } — valida e converte;
// campo sem tipo é tratado como texto puro (comportamento de sempre).
// Devolve { linhas: [{campo: valor}], erros: [string] } — cada erro já
// diz a linha, o campo e o motivo, e a linha inválida é descartada sem
// impedir a importação das demais.
export function parseCsvGenerico(texto, { mapaCampos, obrigatorios, tipos = {} }) {
  const linhasBrutas = texto
    .split(/\r\n|\r|\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (linhasBrutas.length === 0) {
    return { linhas: [], erros: ["Arquivo vazio."] };
  }

  const separador = detectarSeparador(linhasBrutas[0]);
  const cabecalho = parseLinhaCsv(linhasBrutas[0], separador).map(normalizarCabecalho);

  const indicePorCampo = {};
  for (const [campo, variacoes] of Object.entries(mapaCampos)) {
    const idx = cabecalho.findIndex((h) => variacoes.includes(h));
    if (idx >= 0) indicePorCampo[campo] = idx;
  }

  const faltando = obrigatorios.filter((campo) => indicePorCampo[campo] === undefined);
  if (faltando.length > 0) {
    return {
      linhas: [],
      erros: [`Não encontrei a(s) coluna(s) obrigatória(s) "${faltando.join(", ")}" no arquivo. Confira o cabeçalho da primeira linha.`],
    };
  }

  const linhas = [];
  const erros = [];
  for (let i = 1; i < linhasBrutas.length; i++) {
    const campos = parseLinhaCsv(linhasBrutas[i], separador);
    const { linha, errosLinha } = montarLinha(mapaCampos, obrigatorios, tipos, indicePorCampo, (campo) =>
      indicePorCampo[campo] !== undefined ? campos[indicePorCampo[campo]]?.trim() || "" : ""
    );
    if (errosLinha.length > 0) {
      erros.push(`Linha ${i + 1}: ${errosLinha.join("; ")} — ignorada.`);
      continue;
    }
    linhas.push(linha);
  }

  return { linhas, erros };
}

// Monta uma linha validada campo a campo — compartilhado entre o parser
// de CSV e o de XLSX (ver lib/xlsx.js), que só diferem em como leem o
// valor bruto de cada célula. `tipos[campo]` aceita "numero", "data" ou
// { tipo: "opcao", mapa: {codigo: rótulo}, padrao: codigo } pra campos
// tipo status (compara o texto da planilha com os rótulos conhecidos,
// sem diferenciar maiúscula/acento). Validar aqui — e não depois, num
// segundo passo — garante que o número da linha no erro é sempre o da
// planilha original, mesmo quando outras linhas já foram descartadas.
export function montarLinha(mapaCampos, obrigatorios, tipos, indicePorCampo, lerBruto) {
  const linha = {};
  const errosLinha = [];
  for (const campo of Object.keys(mapaCampos)) {
    const bruto = lerBruto(campo);
    const tipo = tipos[campo];
    const vazio = bruto === "" || bruto == null;
    const ehOpcao = tipo && typeof tipo === "object" && tipo.tipo === "opcao";

    if (vazio) {
      linha[campo] = ehOpcao ? tipo.padrao ?? "" : tipo === "numero" ? null : "";
    } else if (tipo === "numero") {
      const numero = parseNumeroBr(bruto);
      if (numero === null) {
        errosLinha.push(`campo "${campo}" com valor inválido ("${bruto}")`);
      } else {
        linha[campo] = numero;
      }
    } else if (tipo === "data") {
      const iso = parseDataBr(bruto);
      if (iso === null) {
        errosLinha.push(`campo "${campo}" com data inválida ("${bruto}")`);
      } else {
        linha[campo] = iso;
      }
    } else if (ehOpcao) {
      const alvo = normalizarCabecalho(String(bruto));
      const encontrado = Object.entries(tipo.mapa).find(([, rotulo]) => normalizarCabecalho(rotulo) === alvo);
      if (encontrado) {
        linha[campo] = encontrado[0];
      } else {
        errosLinha.push(`campo "${campo}" com valor não reconhecido ("${bruto}") — use: ${Object.values(tipo.mapa).join(", ")}`);
      }
    } else {
      linha[campo] = String(bruto).trim();
    }
  }
  for (const campo of obrigatorios) {
    const valor = linha[campo];
    if (valor === undefined || valor === null || valor === "") {
      errosLinha.push(`campo obrigatório "${campo}" vazio`);
    }
  }
  return { linha, errosLinha };
}

// Usa ponto e vírgula como separador: é o padrão do Excel em português
// (o Excel em pt-BR usa vírgula como separador decimal, então trata um
// CSV com vírgula como uma coluna só em vez de separar). A leitura
// (parseCsvGenerico) detecta o separador automaticamente, então um CSV
// com vírgula — de outra origem — continua sendo lido normalmente.
export function gerarCsv(cabecalhos, linhasExemplo) {
  const linhas = [cabecalhos, ...linhasExemplo];
  return linhas.map((l) => l.join(";")).join("\r\n");
}

export function baixarArquivo(conteudo, nomeArquivo, tipo = "text/csv;charset=utf-8;") {
  // BOM UTF-8 no início: sem ele, o Excel abre acentos (ç, ã, é) como
  // caracteres corrompidos.
  const BOM = "﻿";
  const blob = new Blob([BOM + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
