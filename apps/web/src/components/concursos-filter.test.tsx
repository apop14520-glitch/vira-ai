import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { FilterGroup, type FilterOption } from "@/components/concursos-filter";

const options: FilterOption[] = [
  { id: "a", label: "Programação", count: 4 },
  { id: "b", label: "Redes de computadores", count: 2 },
  { id: "c", label: "Segurança", count: 7 },
];

function Harness({ initial = [] as string[], onChange = vi.fn(), ...rest }: { initial?: string[]; onChange?: (ids: string[]) => void; defaultOpen?: boolean }) {
  const [selected, setSelected] = useState(initial);
  return (
    <FilterGroup
      title="Assuntos"
      searchPlaceholder="Buscar assunto"
      options={options}
      selected={selected}
      onChange={(ids) => {
        setSelected(ids);
        onChange(ids);
      }}
      {...rest}
    />
  );
}

describe("FilterGroup", () => {
  it("lista as opções com a contagem e marca e desmarca", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    expect(screen.getByLabelText(/Programação/)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Programação/));
    fireEvent.click(screen.getByLabelText(/Segurança/));
    expect(onChange).toHaveBeenLastCalledWith(["a", "c"]);
    expect(screen.getByLabelText("2 selecionados")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Programação/));
    expect(onChange).toHaveBeenLastCalledWith(["c"]);
  });

  it("busca sem diferenciar acentos nem maiúsculas e avisa quando nada combina", () => {
    render(<Harness />);
    const search = screen.getByRole("searchbox", { name: "Buscar assunto" });

    fireEvent.change(search, { target: { value: "programacao" } });
    expect(screen.getByLabelText(/Programação/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Redes/)).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("Nenhuma opção encontrada.")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  });

  it("recolhe e abre pelo título", () => {
    render(<Harness />);
    const header = screen.getByRole("button", { name: "Assuntos" });

    expect(header).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText(/Programação/)).not.toBeInTheDocument();

    fireEvent.click(header);
    expect(screen.getByLabelText(/Programação/)).toBeInTheDocument();
  });

  it("pode começar recolhido", () => {
    render(<Harness defaultOpen={false} />);

    expect(screen.getByRole("button", { name: "Assuntos" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
});
