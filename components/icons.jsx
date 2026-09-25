// Ícones simples em SVG inline (sem dependência externa) — todos no
// mesmo estilo (stroke 1.8, 20x20, cantos arredondados) pra ficarem
// visualmente consistentes na barra lateral.
function Icon({ children, className = "h-5 w-5" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconVisaoGeral(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

export function IconFinanceiro(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14.5" r="1.4" />
    </Icon>
  );
}

export function IconChamados(props) {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1v-6h3" />
      <path d="M4 12v4a2 2 0 0 0 2 2h1v-6H4" />
      <path d="M9 20h4" />
    </Icon>
  );
}

export function IconAvisos(props) {
  return (
    <Icon {...props}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l4 4V5L6 9H4a1 1 0 0 0-1 1z" />
      <path d="M15 9a3 3 0 0 1 0 6" />
      <path d="M17.5 6.5a7 7 0 0 1 0 11" />
    </Icon>
  );
}

export function IconOcorrencias(props) {
  return (
    <Icon {...props}>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Icon>
  );
}

export function IconManutencao(props) {
  return (
    <Icon {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.9L4 16.5V20h3.5l5.3-5.3a4 4 0 0 0 4.9-5.4l-2.6 2.6-2-2z" />
    </Icon>
  );
}

export function IconFornecedores(props) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="7" width="13" height="10" rx="1.2" />
      <path d="M15.5 10h3.2L21 13.2V17h-5.5" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </Icon>
  );
}

export function IconAcessos(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="18" cy="8.5" r="2.2" />
      <path d="M18 14c2.4 0.3 3.8 2 3.8 4.5" />
    </Icon>
  );
}

export function IconPortaria(props) {
  return (
    <Icon {...props}>
      <path d="M6 21V5a2 2 0 0 1 2-2h5l5 3v15" />
      <path d="M6 21h12" />
      <circle cx="12.5" cy="12" r="0.9" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function IconAuditoria(props) {
  return (
    <Icon {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 0 1 1 1V6H8V4.5a1 1 0 0 1 1-1z" />
      <path d="m8.5 13 2 2 4-4" />
    </Icon>
  );
}

export function IconColaboradores(props) {
  return (
    <Icon {...props}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16.5" cy="9" r="2.3" />
      <path d="M3 20c0-3.3 2.4-5.5 5-5.5s5 2.2 5 5.5" />
      <path d="M14.5 15.2c2.4 0.4 3.8 2.3 3.8 4.8" />
    </Icon>
  );
}

export function IconMoradores(props) {
  return (
    <Icon {...props}>
      <path d="M4 21V10.5a1 1 0 0 1 .4-.8l7-5.4a1 1 0 0 1 1.2 0l7 5.4a1 1 0 0 1 .4.8V21" />
      <path d="M9 21v-6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6" />
    </Icon>
  );
}

export function IconObras(props) {
  return (
    <Icon {...props}>
      <path d="m14.5 3.5 6 6-2 2-6-6z" />
      <path d="m12.5 5.5-8 8v3h3l8-8" />
      <path d="M3.5 20.5h17" />
    </Icon>
  );
}

export function IconConfiguracoes(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V19a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H10a1.7 1.7 0 0 0 1-1.55V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V10c.14.6.62 1.08 1.55 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </Icon>
  );
}

export function IconAcademia(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 9.2v5.6a.6.6 0 0 0 .9.52l4.7-2.8a.6.6 0 0 0 0-1.04l-4.7-2.8a.6.6 0 0 0-.9.52z" />
    </Icon>
  );
}

export function IconRelatorios(props) {
  return (
    <Icon {...props}>
      <path d="M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </Icon>
  );
}

export function IconSol(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </Icon>
  );
}

export function IconLua(props) {
  return (
    <Icon {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />
    </Icon>
  );
}

export function IconMenu(props) {
  return (
    <Icon {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Icon>
  );
}

export function IconX(props) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function IconChevronLeft(props) {
  return (
    <Icon {...props}>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  );
}

export function IconChevronRight(props) {
  return (
    <Icon {...props}>
      <path d="M9 18l6-6-6-6" />
    </Icon>
  );
}

export function IconSair(props) {
  return (
    <Icon {...props}>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Icon>
  );
}

export function IconOlhoAberto(props) {
  return (
    <Icon {...props}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

export function IconOlhoFechado(props) {
  return (
    <Icon {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a15.6 15.6 0 0 1-4 4.6" />
      <path d="M6.3 6.3C3.6 8.1 2 12 2 12s3.6 7 10 7a9.6 9.6 0 0 0 4.2-1" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </Icon>
  );
}

export function IconCopiar(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Icon>
  );
}
