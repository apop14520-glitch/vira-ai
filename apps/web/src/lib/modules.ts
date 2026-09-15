export type ModuleTone = "cyan" | "emerald" | "violet" | "amber";

export type ProductModule = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  symbol: string;
  tone: ModuleTone;
  capabilities: string[];
};

export const productModules: ProductModule[] = [
  {
    slug: "business",
    title: "VIRA Business",
    eyebrow: "Operações e crescimento",
    description: "O espaço para organizar inteligência comercial e dados empresariais com clareza.",
    symbol: "B",
    tone: "cyan",
    capabilities: ["Organizações", "Dados empresariais", "Uso"],
  },
  {
    slug: "sites",
    title: "VIRA Sites",
    eyebrow: "Presença digital",
    description: "O futuro studio para criar experiências digitais com uma base segura e modular.",
    symbol: "S",
    tone: "emerald",
    capabilities: ["Projetos", "Conteúdo", "Publicação"],
  },
  {
    slug: "studio",
    title: "VIRA Studio",
    eyebrow: "Criação com IA",
    description: "O ambiente para construir fluxos e agentes sobre o AI Gateway do VIRA.AI.",
    symbol: "✦",
    tone: "violet",
    capabilities: ["Agentes", "Fluxos", "Provedores"],
  },
  {
    slug: "concursos",
    title: "VIRA Concursos",
    eyebrow: "Oportunidades públicas",
    description: "O módulo preparado para organizar oportunidades com proveniência e finalidade documentadas.",
    symbol: "C",
    tone: "amber",
    capabilities: ["Fontes", "Proveniência", "Alertas"],
  },
];
