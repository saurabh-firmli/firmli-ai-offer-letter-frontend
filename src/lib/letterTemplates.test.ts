import { insertVariableText, toVariableOptions } from "./letterTemplates";

describe("insertVariableText", () => {
  it("puts a text variable at the cursor, inline", () => {
    expect(insertVariableText("Dear , welcome", 5, 5, "student_full_name")).toEqual({
      value: "Dear {{student_full_name}}, welcome",
      cursor: 26,
    });
  });

  it("replaces the selected text", () => {
    expect(insertVariableText("Dear NAME,", 5, 9, "student_full_name").value).toBe(
      "Dear {{student_full_name}},"
    );
  });

  it("puts a block variable on a line of its own", () => {
    expect(insertVariableText("Conditions: apply", 12, 12, "conditions").value).toBe(
      "Conditions: \n{{conditions}}\napply"
    );
  });

  it("adds no extra line breaks when the cursor is already on an empty line", () => {
    expect(insertVariableText("Intro\n\nOutro", 6, 6, "eligibility_table").value).toBe(
      "Intro\n{{eligibility_table}}\nOutro"
    );
    expect(insertVariableText("", 0, 0, "missing_documents").value).toBe("{{missing_documents}}");
  });
});

describe("toVariableOptions", () => {
  it("keeps the API order and groups block variables apart", () => {
    const options = toVariableOptions([
      { key: "student_full_name", label: "Student Full Name" },
      { key: "conditions", label: "Conditions" },
      { key: "program_name", label: "Program Name" },
    ]);
    expect(options).toEqual([
      {
        group: "Text",
        items: [
          { value: "student_full_name", label: "Student Full Name" },
          { value: "program_name", label: "Program Name" },
        ],
      },
      { group: "Blocks (own line)", items: [{ value: "conditions", label: "Conditions" }] },
    ]);
  });

  it("leaves out the blocks group when there are none", () => {
    expect(toVariableOptions([{ key: "campus", label: "Campus" }])).toHaveLength(1);
  });
});
