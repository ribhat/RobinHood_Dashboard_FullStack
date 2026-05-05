import { render, screen } from "@testing-library/react";
import IncomeCalendar from "./IncomeCalendar";

const incomeCalendar = {
  year: 2026,
  as_of_date: "2026-05-04",
  summary: {
    current_month_income: 20.63,
    current_month_received: 0.9,
    current_month_estimated: 19.73,
    remaining_estimated_annual_income: 227.71,
    total_projected_annual_income: 334.71,
  },
  months: [
    {
      month: "05",
      month_name: "May",
      total: 20.63,
      received: 0.9,
      estimated: 19.73,
      items: [
        {
          ticker: "SCHD",
          date: "2026-05-01",
          amount: 0.9,
          status: "received",
        },
        {
          ticker: "JEPI",
          date: "2026-05-05",
          amount: 5.25,
          status: "estimated",
        },
      ],
    },
  ],
};

describe("IncomeCalendar", () => {
  it("keeps detailed month payments without duplicating the promoted summary tiles", () => {
    render(<IncomeCalendar data={incomeCalendar} />);

    expect(
      screen.getByRole("heading", { name: "2026 Dividend Payments" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "May" })).toBeInTheDocument();
    expect(screen.getByText("SCHD")).toBeInTheDocument();
    expect(screen.getByText("JEPI")).toBeInTheDocument();
    expect(screen.getByText("$0.90 received")).toBeInTheDocument();
    expect(screen.getByText("$19.73 estimated remaining")).toBeInTheDocument();

    expect(screen.queryByText("Next Expected Payment")).not.toBeInTheDocument();
    expect(screen.queryByText("May Income")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Remaining Estimated Annual Income")
    ).not.toBeInTheDocument();
  });
});
