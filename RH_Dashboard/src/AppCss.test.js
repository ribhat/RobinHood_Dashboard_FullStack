import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appCss = readFileSync(resolve("src/App.css"), "utf8");

describe("App CSS layout contracts", () => {
  it("sizes metric values from their card container to avoid overflow", () => {
    expect(appCss).toMatch(
      /\.metric-card-value,\s*\.portfolio-metric-value\s*\{[^}]*font-size:\s*clamp\([^)]*cqi[^)]*\)/s
    );
  });

  it("keeps portfolio insight header badges inside narrow cards", () => {
    expect(appCss).toMatch(
      /\.portfolio-insight-header\s*\{[^}]*flex-wrap:\s*wrap[^}]*\}/s
    );
    expect(appCss).toMatch(
      /\.projection-basis\s*\{[^}]*max-width:\s*100%[^}]*white-space:\s*normal[^}]*\}/s
    );
  });

  it("stacks compact top mover rows to avoid value overlap", () => {
    expect(appCss).toMatch(
      /\.performance-list\s*\{[^}]*container-type:\s*inline-size[^}]*\}/s
    );
    expect(appCss).toMatch(/@container\s*\(max-width:\s*14rem\)/);
    expect(appCss).toMatch(
      /\.performance-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*\}/s
    );
    expect(appCss).toMatch(
      /\.performance-values\s*\{[^}]*text-align:\s*left[^}]*\}/s
    );
  });
});
