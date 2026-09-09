"""Portuguese labels for provider categories shown in the VIRA Business UI.

Provider category names are external data. They are translated at the adapter
boundary so the frontend can remain language-consistent without changing the
official business name, address, or website returned by the provider.
"""

from __future__ import annotations

import re
import unicodedata


_CATEGORY_TRANSLATIONS = {
    "accounting and tax": "Contabilidade e tributos",
    "advertising agency": "Agência de publicidade",
    "amusement park": "Parque de diversões",
    "animal shelter": "Abrigo de animais",
    "aquarium": "Aquário",
    "arcade": "Fliperama",
    "atm": "Caixa eletrônico",
    "airport": "Aeroporto",
    "airport terminal": "Terminal aeroportuário",
    "art gallery": "Galeria de arte",
    "arts and entertainment": "Artes e entretenimento",
    "auto garage": "Oficina mecânica",
    "auto dealership": "Concessionária de veículos",
    "automotive repair shop": "Oficina mecânica",
    "bakery": "Padaria",
    "bank": "Banco",
    "bar": "Bar",
    "barber shop": "Barbearia",
    "beach": "Praia",
    "beauty salon": "Salão de beleza",
    "bookstore": "Livraria",
    "bowling alley": "Boliche",
    "brewery": "Cervejaria",
    "bbq joint": "Churrascaria",
    "bed & breakfast": "Pousada",
    "breakfast spot": "Café da manhã",
    "bus station": "Rodoviária",
    "business and professional services": "Serviços empresariais e profissionais",
    "business service": "Serviços empresariais",
    "business center": "Centro empresarial",
    "butcher": "Açougue",
    "cafe": "Cafeteria",
    "café": "Cafeteria",
    "car dealership": "Concessionária de veículos",
    "car rental": "Locadora de veículos",
    "car parts and accessories": "Peças e acessórios automotivos",
    "car wash": "Lava-jato",
    "church": "Igreja",
    "clothing store": "Loja de roupas",
    "coffee shop": "Cafeteria",
    "college and university": "Faculdade e universidade",
    "comedy club": "Clube de comédia",
    "convenience store": "Loja de conveniência",
    "concert hall": "Sala de concertos",
    "consulting": "Consultoria",
    "cosmetics shop": "Loja de cosméticos",
    "coworking space": "Espaço de coworking",
    "daycare": "Creche",
    "dentist's office": "Consultório odontológico",
    "department store": "Loja de departamentos",
    "dessert shop": "Loja de sobremesas",
    "diner": "Lanchonete",
    "discount store": "Loja de descontos",
    "dog run": "Área para cães",
    "electronics store": "Loja de eletrônicos",
    "escape room": "Sala de fuga",
    "event space": "Espaço para eventos",
    "factory": "Fábrica",
    "fast food restaurant": "Restaurante fast-food",
    "financial services": "Serviços financeiros",
    "fish market": "Peixaria",
    "flea market": "Feira de usados",
    "florist": "Floricultura",
    "food truck": "Food truck",
    "food court": "Praça de alimentação",
    "food and drink shop": "Loja de alimentos e bebidas",
    "furniture store": "Loja de móveis",
    "gas station": "Posto de combustível",
    "gift shop": "Loja de presentes",
    "grocery store": "Mercado",
    "farmers market": "Feira de produtores",
    "fitness center": "Centro de treinamento",
    "guest house": "Pousada",
    "hair salon": "Salão de cabeleireiro",
    "hardware store": "Loja de materiais de construção",
    "health and beauty service": "Serviço de saúde e beleza",
    "hospital": "Hospital",
    "hostel": "Hostel",
    "hotel": "Hotel",
    "ice cream shop": "Sorveteria",
    "insurance office": "Corretora de seguros",
    "japanese restaurant": "Restaurante japonês",
    "jewelry store": "Joalheria",
    "juice bar": "Casa de sucos",
    "karaoke bar": "Bar de karaokê",
    "lawyer": "Escritório de advocacia",
    "laundry service": "Lavanderia",
    "library": "Biblioteca",
    "locksmith": "Chaveiro",
    "lounge": "Lounge",
    "market": "Mercado",
    "marketing agency": "Agência de marketing",
    "medical center": "Centro médico",
    "medical clinic": "Clínica médica",
    "mobile phone shop": "Loja de celulares",
    "mosque": "Mesquita",
    "movie theater": "Cinema",
    "museum": "Museu",
    "nightclub": "Casa noturna",
    "nail salon": "Salão de manicure",
    "office": "Escritório",
    "optical shop": "Ótica",
    "park": "Parque",
    "parking": "Estacionamento",
    "pastry shop": "Confeitaria",
    "pet store": "Pet shop",
    "pharmacy": "Farmácia",
    "pizza place": "Pizzaria",
    "post office": "Agência dos Correios",
    "playground": "Parque infantil",
    "pub": "Pub",
    "real estate": "Imobiliária",
    "real estate office": "Imobiliária",
    "restaurant": "Restaurante",
    "sandwich spot": "Lanchonete de sanduíches",
    "school": "Escola",
    "seafood restaurant": "Restaurante de frutos do mar",
    "shoe store": "Sapataria",
    "shopping mall": "Shopping center",
    "spa": "Spa",
    "sports bar": "Bar esportivo",
    "stadium": "Estádio",
    "steakhouse": "Restaurante de carnes",
    "structure": "Estrutura",
    "supermarket": "Supermercado",
    "tailor shop": "Alfaiataria",
    "temple": "Templo",
    "theater": "Teatro",
    "toy and game store": "Loja de brinquedos e jogos",
    "train station": "Estação de trem",
    "travel agency": "Agência de viagens",
    "tourist attraction": "Atração turística",
    "tourist information center": "Centro de informações turísticas",
    "university": "Universidade",
    "veterinarian": "Clínica veterinária",
    "veterinary clinic": "Clínica veterinária",
    "wine shop": "Loja de vinhos",
    "wine bar": "Bar de vinhos",
    "wholesale store": "Atacadista",
    "yoga studio": "Estúdio de yoga",
    "zoo": "Zoológico",
}


_PORTUGUESE_CATEGORY_HINTS = {
    "academia",
    "açougue",
    "bar",
    "banco",
    "biblioteca",
    "cafeteria",
    "clínica",
    "confeitaria",
    "consultório",
    "escola",
    "estabelecimento",
    "farmácia",
    "feira",
    "floricultura",
    "hotel",
    "igreja",
    "imobiliária",
    "lanchonete",
    "loja",
    "mercado",
    "padaria",
    "parque",
    "pizzaria",
    "restaurante",
    "salão",
    "serviço",
    "serviços",
    "supermercado",
    "estrutura",
    "churrascaria",
    "comércio",
    "comercial",
    "profissional",
    "produtores",
    "sorveteria",
    "sapataria",
    "mercearia",
    "artesanato",
    "brasileiro",
    "brasileira",
}


def _normalize(value: str) -> str:
    """Normalize provider labels for matching without changing display text."""

    normalized = unicodedata.normalize("NFKC", value).strip().casefold()
    normalized = normalized.replace("’", "'")
    return re.sub(r"\s+", " ", normalized)


def _is_probably_portuguese(value: str) -> bool:
    """Keep an already localized label instead of translating it again."""

    normalized = _normalize(value)
    words = set(re.findall(r"[\wÀ-ÿ]+", normalized))
    return bool(
        words.intersection(_PORTUGUESE_CATEGORY_HINTS)
        or any(character in normalized for character in "áàâãéêíóôõúç")
    )


def translate_category_name(value: str) -> str:
    """Translate one category without allowing English labels into the UI."""

    clean_value = value.strip()
    if not clean_value:
        return "Estabelecimento local"
    translated = _CATEGORY_TRANSLATIONS.get(_normalize(clean_value))
    if translated:
        return translated
    if _is_probably_portuguese(clean_value):
        return clean_value
    return "Estabelecimento local"


def translate_category_names(values: list[str]) -> str | None:
    """Translate and join the categories used as the lead segment."""

    categories = [part.strip() for value in values for part in value.split(",") if part.strip()]
    translated = [translate_category_name(value) for value in categories]
    return ", ".join(translated) or None
