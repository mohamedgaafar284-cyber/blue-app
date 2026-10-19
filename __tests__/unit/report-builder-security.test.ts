import { describe, it, expect } from "@jest/globals";
import { validateReportDefinition } from "@/lib/services/report-builder.service";

describe("Report Builder — Security & Isolation", () => {
  it("should validate and require data source and fields", () => {
    const emptyDef = {};
    const errors = validateReportDefinition(emptyDef);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("Data source is required");
    expect(errors).toContain("At least one field is required");
  });

  it("should reject invalid data sources", () => {
    const invalidDef = {
      dataSource: "invalid_secret_table" as any,
      fields: [{ key: "id", label: "ID", aggregation: "count" as const }],
    };
    const errors = validateReportDefinition(invalidDef);
    expect(errors.some((e) => e.includes("Invalid data source"))).toBe(true);
  });

  it("should reject invalid field keys for a data source", () => {
    const invalidFieldDef = {
      dataSource: "projects" as const,
      fields: [{ key: "nonExistentField", label: "Non Existent", aggregation: "count" as const }],
    };
    const errors = validateReportDefinition(invalidFieldDef);
    expect(errors.some((e) => e.includes("Invalid field key"))).toBe(true);
  });

  it("should pass for a valid report definition", () => {
    const validDef = {
      dataSource: "projects" as const,
      fields: [
        { key: "name", label: "Project Name", aggregation: "count" as const },
        { key: "budget", label: "Budget", aggregation: "sum" as const },
      ],
      filters: [
        { field: "status", operator: "eq" as const, value: "IN_PROGRESS" },
      ],
    };
    const errors = validateReportDefinition(validDef);
    expect(errors).toEqual([]);
  });
});
