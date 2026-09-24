"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/adminFetch";
import { apenasDigitos, validarCnpj } from "@/lib/validacaoDocumentos";
import CategoriasFornecedorInput from "@/components/CategoriasFornecedorInput";

const emptyForm = {
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  endereco: "",
  categorias: [],
  status: "ativo",
};

// Cadastro direto de um fornecedor na base geral Vizinn, pelo próprio
// painel admin — sem depender de um condomínio importar/cadastrar
// primeiro (ver /admin/fornecedores).
export default function AdminFornecedorGlobalCriarModal({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState("");

  async function handleSalvar(e) {
    e.preventDefault();
    const digitos = apenasDigitos(form.cnpj);
    if (digitos.length !== 14 || !validarCnpj(digitos)) {
      setError("CNPJ inválido. Confira os números digitados.");
      return;
    }
    setSalvando(true);
    setError("");
    try {
      const res = await authedFetch("/api/admin/fornecedores-globais", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: digitos,
          razao_social: form.razaoSocial.trim(),
          nome_fantasia: form.nomeFantasia.trim() || null,
          endereco: form.endereco.trim() || null,
          categorias: form.categorias,
          status: form.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao cadastrar fornecedor.");
      onCreated();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/60 px-4 py-8 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-navy-900">Novo fornecedor na base geral</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-700" aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSalvar} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {error && <p className="text-sm text-coral-700 sm:col-span-2">{error}</p>}
          <div className="sm:col-span-2">
            <label className="label-field">Razão social</label>
            <input
              className="input-field"
              value={form.razaoSocial}
              onChange={(e) => setForm((f) => ({ ...f, razaoSocial: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label-field">Nome fantasia</label>
            <input
              className="input-field"
              value={form.nomeFantasia}
              onChange={(e) => setForm((f) => ({ ...f, nomeFantasia: e.target.value }))}
            />
          </div>
          <div>
            <label className="label-field">CNPJ</label>
            <input
              className="input-field"
              value={form.cnpj}
              onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Categorias</label>
            <CategoriasFornecedorInput
              value={form.categorias}
              onChange={(categorias) => setForm((f) => ({ ...f, categorias }))}
              inputId="categorias-fornecedor-admin-criar"
            />
          </div>
          <div>
            <label className="label-field">Status</label>
            <select
              className="input-field"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Endereço</label>
            <input
              className="input-field"
              value={form.endereco}
              onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <button type="submit" disabled={salvando} className="btn-primary text-sm">
              {salvando ? "Cadastrando..." : "Cadastrar fornecedor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
