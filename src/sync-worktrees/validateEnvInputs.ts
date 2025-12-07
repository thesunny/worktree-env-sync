/**
 * Validates that all input files have the same set of keys.
 * Logs details and throws an error if any inconsistencies are found.
 */
function validateInputFilesConsistency(
  inputFiles: Map<string, Record<string, string>>
): void {
  const entries = Array.from(inputFiles.entries());
  if (entries.length < 2) return;

  const [firstFile, firstVars] = entries[0]!;
  const firstKeys = new Set(Object.keys(firstVars));

  for (const [file, vars] of entries.slice(1)) {
    const keys = new Set(Object.keys(vars));

    const missingKeys = [...firstKeys].filter((k) => !keys.has(k));
    const extraKeys = [...keys].filter((k) => !firstKeys.has(k));

    if (missingKeys.length > 0 || extraKeys.length > 0) {
      console.log(`Input file inconsistency detected:`);
      console.log(`  Comparing ${file} to ${firstFile}`);
      if (missingKeys.length > 0) {
        console.log(`  Missing keys: ${missingKeys.join(", ")}`);
      }
      if (extraKeys.length > 0) {
        console.log(`  Extra keys: ${extraKeys.join(", ")}`);
      }
      throw new Error("Input files have inconsistent keys");
    }
  }
}

/**
 * Validates that template and input variables don't share any keys.
 * Throws an error if any conflicts are found.
 */
function validateNoConflicts(
  templateVars: Record<string, string>,
  inputVars: Record<string, string>,
  inputFile: string
): void {
  const templateKeys = new Set(Object.keys(templateVars));
  const inputKeys = Object.keys(inputVars);

  const conflicts = inputKeys.filter((k) => templateKeys.has(k));
  if (conflicts.length > 0) {
    throw new Error(
      `Template and input file "${inputFile}" have conflicting keys: ${conflicts.join(
        ", "
      )}`
    );
  }
}

/**
 * Validates all input files and template variables.
 * Ensures input files have consistent keys and don't conflict with template.
 */
export function validateEnvInputs(
  templateVars: Record<string, string>,
  inputFiles: Map<string, Record<string, string>>
): void {
  validateInputFilesConsistency(inputFiles);

  for (const [sourceFile, vars] of inputFiles) {
    validateNoConflicts(templateVars, vars, sourceFile);
  }
}
