export type BrazilianState = { uf: string; name: string };

export const BRAZILIAN_STATES: BrazilianState[] = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

/**
 * Small offline fallback. The browser attempts to load the complete official
 * municipality list from IBGE after an UF is selected; these capital and
 * regional cities keep the selector useful when the public service is offline.
 */
export const FALLBACK_MUNICIPALITIES_BY_STATE: Record<string, string[]> = {
  AC: ["Rio Branco", "Cruzeiro do Sul", "Sena Madureira", "Tarauacá", "Feijó", "Brasiléia", "Xapuri"],
  AL: ["Maceió", "Arapiraca", "Rio Largo", "Palmeira dos Índios", "Penedo", "Marechal Deodoro", "São Miguel dos Campos"],
  AP: ["Macapá", "Santana", "Laranjal do Jari", "Oiapoque", "Mazagão", "Porto Grande"],
  AM: ["Manaus", "Parintins", "Itacoatiara", "Manacapuru", "Coari", "Tefé", "Tabatinga", "Humaitá", "Iranduba", "Maués", "São Gabriel da Cachoeira", "Benjamin Constant"],
  BA: ["Salvador", "Feira de Santana", "Vitória da Conquista", "Camaçari", "Juazeiro", "Itabuna", "Ilhéus", "Barreiras", "Porto Seguro", "Lauro de Freitas"],
  CE: ["Fortaleza", "Caucaia", "Juazeiro do Norte", "Maracanaú", "Sobral", "Crato", "Itapipoca", "Maranguape", "Iguatu", "Quixadá"],
  DF: ["Brasília"],
  ES: ["Vitória", "Vila Velha", "Serra", "Cariacica", "Linhares", "Cachoeiro de Itapemirim", "Colatina", "Guarapari", "São Mateus"],
  GO: ["Goiânia", "Aparecida de Goiânia", "Anápolis", "Rio Verde", "Luziânia", "Águas Lindas de Goiás", "Valparaíso de Goiás", "Trindade", "Catalão", "Itumbiara"],
  MA: ["São Luís", "Imperatriz", "São José de Ribamar", "Timon", "Caxias", "Codó", "Paço do Lumiar", "Açailândia", "Bacabal", "Balsas"],
  MT: ["Cuiabá", "Várzea Grande", "Rondonópolis", "Sinop", "Sorriso", "Tangará da Serra", "Cáceres", "Lucas do Rio Verde", "Barra do Garças", "Alta Floresta"],
  MS: ["Campo Grande", "Dourados", "Três Lagoas", "Corumbá", "Ponta Porã", "Naviraí", "Nova Andradina", "Sidrolândia", "Aquidauana", "Paranaíba"],
  MG: ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora", "Betim", "Montes Claros", "Ribeirão das Neves", "Uberaba", "Governador Valadares", "Ipatinga", "Poços de Caldas"],
  PA: ["Belém", "Ananindeua", "Santarém", "Marabá", "Parauapebas", "Castanhal", "Abaetetuba", "Altamira", "Cametá", "Bragança", "Barcarena"],
  PB: ["João Pessoa", "Campina Grande", "Santa Rita", "Patos", "Bayeux", "Sousa", "Cabedelo", "Cajazeiras", "Guarabira", "Mamanguape"],
  PR: ["Curitiba", "Londrina", "Maringá", "Ponta Grossa", "Cascavel", "São José dos Pinhais", "Foz do Iguaçu", "Colombo", "Guarapuava", "Paranaguá", "Toledo"],
  PE: ["Recife", "Jaboatão dos Guararapes", "Olinda", "Caruaru", "Petrolina", "Paulista", "Cabo de Santo Agostinho", "Camaragibe", "Garanhuns", "Vitória de Santo Antão"],
  PI: ["Teresina", "Parnaíba", "Picos", "Piripiri", "Floriano", "Campo Maior", "Barras", "Oeiras", "São Raimundo Nonato", "Corrente"],
  RJ: ["Rio de Janeiro", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu", "Niterói", "Belford Roxo", "Campos dos Goytacazes", "São João de Meriti", "Petrópolis", "Volta Redonda", "Macaé"],
  RN: ["Natal", "Mossoró", "Parnamirim", "São Gonçalo do Amarante", "Macaíba", "Ceará-Mirim", "Caicó", "Açu", "Currais Novos", "Pau dos Ferros"],
  RS: ["Porto Alegre", "Caxias do Sul", "Canoas", "Pelotas", "Santa Maria", "Gravataí", "Viamão", "Novo Hamburgo", "São Leopoldo", "Rio Grande", "Passo Fundo"],
  RO: ["Porto Velho", "Ji-Paraná", "Ariquemes", "Vilhena", "Cacoal", "Rolim de Moura", "Jaru", "Guajará-Mirim", "Ouro Preto do Oeste", "Buritis"],
  RR: ["Boa Vista", "Rorainópolis", "Caracaraí", "Alto Alegre", "Pacaraima", "Mucajaí", "Cantá"],
  SC: ["Florianópolis", "Joinville", "Blumenau", "São José", "Chapecó", "Itajaí", "Criciúma", "Jaraguá do Sul", "Lages", "Balneário Camboriú", "Brusque"],
  SP: ["São Paulo", "Guarulhos", "Campinas", "São Bernardo do Campo", "Santo André", "São José dos Campos", "Osasco", "Ribeirão Preto", "Sorocaba", "Mauá", "Santos", "São José do Rio Preto"],
  SE: ["Aracaju", "Nossa Senhora do Socorro", "Lagarto", "Itabaiana", "Estância", "São Cristóvão", "Tobias Barreto", "Propriá", "Simão Dias"],
  TO: ["Palmas", "Araguaína", "Gurupi", "Porto Nacional", "Paraíso do Tocantins", "Colinas do Tocantins", "Guaraí", "Tocantinópolis", "Dianópolis"],
};

const municipalityCache = new Map<string, string[]>();

export function fallbackMunicipalities(state: string): string[] {
  return [...(FALLBACK_MUNICIPALITIES_BY_STATE[state] ?? [])].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function fetchMunicipalities(state: string, signal?: AbortSignal): Promise<string[]> {
  const uf = state.trim().toUpperCase();
  const cached = municipalityCache.get(uf);
  if (cached) return cached;

  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`, { signal });
  if (!response.ok) throw new Error("Não foi possível carregar os municípios agora.");
  const payload = (await response.json()) as Array<{ nome?: unknown }>;
  const municipalities = payload
    .map((item) => (typeof item.nome === "string" ? item.nome.trim() : ""))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (municipalities.length === 0) throw new Error("O estado não retornou municípios.");
  municipalityCache.set(uf, municipalities);
  return municipalities;
}
