/**
 * Validates that template keys don't have literal values that conflict with input keys.
 * A conflict occurs when the template has a key that also exists in input,
 * but the template value doesn't reference that input variable via ${KEY}.
 * Throws an error if any conflicts are found.
 */
function validateNoConflicts(
  templateVars: Record<string, string>,
  inputVars: Record<string, string>,
  inputFile: string,
  templateContent: string
): void {
  const inputKeys = Object.keys(inputVars);

  const conflicts = inputKeys.filter((key) => {
    if (!(key in templateVars)) return false;
    // Check if the template references this key via ${KEY}
    const refPattern = new RegExp(`\\$\\{${key}\\}`);
    return !refPattern.test(templateContent);
  });

  if (conflicts.length > 0) {
    throw new Error(
      `Template has literal values for keys also in input file "${inputFile}": ${conflicts.join(
        ", "
      )}. Use \${${conflicts[0]}} to reference the input value.`
    );
  }
}

/**
 * Validates all input files and template variables.
 * Ensures template doesn't have literal values for keys that exist in input.
 */
export function validateEnvInputs(
  templateVars: Record<string, string>,
  inputFiles: Map<string, Record<string, string>>,
  templateContent: string
): void {
  for (const [sourceFile, vars] of inputFiles) {
    validateNoConflicts(templateVars, vars, sourceFile, templateContent);
  }
}
