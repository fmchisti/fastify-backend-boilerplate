import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allowedOptions as cliAllowedOptions,
  readChoices,
} from "../../packages/create-fastra/src/choices.ts";
import { buildChoices, CHOICES_FILE } from "../../setup/choices.ts";
import { allowedOptions, validateSelection } from "../../setup/engine.ts";
import { FEATURE_IDS, features } from "../../setup/features.ts";

const root = path.resolve(import.meta.dirname, "../..");

/** Every partial selection reachable by answering features in order. */
const partialSelections = (): Record<string, string>[] => {
  let level: Record<string, string>[] = [{}];
  const all: Record<string, string>[] = [{}];
  for (const id of FEATURE_IDS) {
    level = level.flatMap((selection) =>
      allowedOptions(selection, id).map((option) => ({ ...selection, [id]: option })),
    );
    all.push(...level);
  }
  return all;
};

describe("setup/choices.json", () => {
  it("matches features.ts (run `pnpm setup:choices` after changing it)", async () => {
    const written: unknown = JSON.parse(await readFile(path.join(root, CHOICES_FILE), "utf8"));
    expect(written).toEqual(buildChoices());
  });

  it("is readable by create-fastra", async () => {
    expect(await readChoices(root)).toEqual(buildChoices());
  });

  it("lets create-fastra offer exactly the options setup accepts", async () => {
    const choices = await readChoices(root);
    if (!choices) throw new Error("choices.json missing");
    for (const selection of partialSelections()) {
      for (const id of FEATURE_IDS) {
        if (id in selection) continue;
        expect(cliAllowedOptions(choices, selection, id), `${id} after ${JSON.stringify(selection)}`).toEqual(
          allowedOptions(selection, id),
        );
      }
    }
  });

  it("only produces complete selections setup accepts", () => {
    const complete = partialSelections().filter(
      (selection) => Object.keys(selection).length === FEATURE_IDS.length,
    );
    expect(complete.length).toBeGreaterThan(0);
    for (const selection of complete) expect(() => validateSelection(selection)).not.toThrow();
    expect(Object.keys(features)).toEqual([...FEATURE_IDS]);
  });
});
