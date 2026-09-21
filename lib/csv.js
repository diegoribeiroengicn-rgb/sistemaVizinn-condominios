// Parser de CSV compartilhado — usado por Moradores e Colaboradores pra
// importar planilha (.csv exportado do Excel/Google Sheets). Sem lib
// externa (evita dependência com vulnerabilidades conhecidas só pra ler
// um arquivo simples — ver histórico do módulo Moradores).

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
// Devolve { linhas: [{campo: valor}], erros: [string] }.
export function parseCsvGenerico(texto, { mapaCampos, obrigatorios }) {
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
    const linha = {};
    for (const campo of Object.keys(mapaCampos)) {
      linha[campo] = indicePorCampo[campo] !== undefined ? campos[indicePorCampo[campo]]?.trim() || "" : "";
    }
    const faltandoNaLinha = obrigatorios.some((campo) => !linha[campo]);
    if (faltandoNaLinha) {
      erros.push(`Linha ${i + 1}: faltando ${obrigatorios.join("/")} — ignorada.`);
      continue;
    }
    linhas.push(linha);
  }

  return { linhas, erros };
}

export function gerarCsv(cabecalhos, linhasExemplo) {
  const linhas = [cabecalhos, ...linhasExemplo];
  return linhas.map((l) => l.join(",")).join("\r\n");
}

export function baixarArquivo(conteudo, nomeArquivo, tipo = "text/csv;charset=utf-8;") {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
