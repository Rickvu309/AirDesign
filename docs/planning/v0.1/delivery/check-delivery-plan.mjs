import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const deliveryDirectory = process.argv[2] ?? dirname(fileURLToPath(import.meta.url));
const planPath = join(deliveryDirectory, "autopilot-plan.md");
const contractIndexPath = join(deliveryDirectory, "contract-index.json");
const phaseDataPath = join(deliveryDirectory, "phase-data.json");
const lanePredicatesPath = join(deliveryDirectory, "lane-predicates.json");
const pullRequestOrder = ["P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09"];
const modelSlugPattern = /\b(?:grok|gpt|claude|gemini)(?:-[a-z]+)*-\d[\w.-]*/gi;
const modelSlugExamples = ["gpt-6.1-sol", "grok-4.7", "claude-opus-4-6", "grok-code-fast-1", "gemini-3.8-flash-high"];
const modelProseExamples = ["Grok implements and Codex reviews", "Claude plus a second model", "Codex guide over authorized endpoint"];
const blanketAcceptancePhrases = ["every shared contract is accepted", "resolves every forward reference"];
const planningBranchPattern = /(?<![\w/.])planning\/v0\.1(?!\/)/g;
const verificationSentence = "Tests alone are not sufficient verification";
const failures = [];

function checkModelSlugPatternExamples() {
  for (const example of modelSlugExamples) {
    if (!new RegExp(modelSlugPattern.source, "i").test(example)) {
      failures.push(`c: model slug pattern misses ${example}`);
    }
  }
  for (const example of modelProseExamples) {
    if (new RegExp(modelSlugPattern.source, "i").test(example)) {
      failures.push(`c: model slug pattern wrongly matches "${example}"`);
    }
  }
}

function checkDeferredAcceptanceWording(contractIndex) {
  for (const [contractId, contract] of Object.entries(contractIndex.contracts ?? {})) {
    for (const match of String(contract.requiredDecision ?? "").matchAll(/\b(P0[1-9]) must accept\b/g)) {
      if (match[1] !== contract.freezeIn) {
        failures.push(`g: ${contractId} says ${match[1]} must accept it but freezeIn is ${contract.freezeIn}`);
      }
    }
  }
}

function checkBlanketAcceptance(label, text) {
  for (const phrase of blanketAcceptancePhrases) {
    if (text.includes(phrase)) {
      failures.push(`h: ${label} still requires "${phrase}" although later contracts freeze in later PRs`);
    }
  }
}

function readDeliveryText(path) {
  return readFileSync(path, "utf8");
}

function parseDeliveryJson(path, label) {
  try {
    return JSON.parse(readDeliveryText(path));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`f: ${label} does not parse: ${message}`);
    return null;
  }
}

function contractIdsInSection(section, pullRequest) {
  const referenceLine = section
    .split("\n")
    .find((line) => line.startsWith("**Contract references.**"));
  if (!referenceLine) {
    failures.push(`b: ${pullRequest} section has no Contract references line`);
    return null;
  }
  return referenceLine.match(/\bC\d{2}\b/g) ?? [];
}

function contractIdsByPullRequest(planText) {
  const headingMatches = [...planText.matchAll(/^## .+\((P0[1-9])\)\s*$/gm)];
  const lists = {};
  for (let index = 0; index < headingMatches.length; index += 1) {
    const pullRequest = headingMatches[index][1];
    const start = headingMatches[index].index ?? 0;
    const end =
      index + 1 < headingMatches.length ? headingMatches[index + 1].index ?? planText.length : planText.length;
    lists[pullRequest] = contractIdsInSection(planText.slice(start, end), pullRequest);
  }
  return lists;
}

function checkFreezeAssignments(contractIndex) {
  const contracts = contractIndex.contracts ?? {};
  const pullRequestReferences = contractIndex.prReferences ?? {};
  for (const contractId of Object.keys(contracts)) {
    const contract = contracts[contractId];
    const freezeIn = contract.freezeIn;
    if (typeof freezeIn !== "string" || freezeIn.length === 0) {
      failures.push(`a: ${contractId} is missing freezeIn`);
      continue;
    }
    const firstPullRequest = pullRequestOrder.find((pullRequest) =>
      (pullRequestReferences[pullRequest] ?? []).includes(contractId),
    );
    if (freezeIn !== firstPullRequest) {
      failures.push(
        `a: ${contractId} freezeIn is ${freezeIn} but the first prReferences PR is ${firstPullRequest ?? "none"}`,
      );
    }
  }
}

function checkPlanReferences(planText, contractIndex) {
  const lists = contractIdsByPullRequest(planText);
  for (const pullRequest of pullRequestOrder) {
    const planIds = lists[pullRequest];
    const registerIds = contractIndex.prReferences?.[pullRequest];
    if (!planIds) {
      failures.push(`b: plan has no ${pullRequest} contract reference list`);
      continue;
    }
    if (!registerIds) {
      failures.push(`b: contract-index has no prReferences.${pullRequest}`);
      continue;
    }
    if (planIds.join(",") !== registerIds.join(",")) {
      failures.push(
        `b: ${pullRequest} plan contract references [${planIds.join(", ")}] differ from prReferences [${registerIds.join(", ")}]`,
      );
    }
  }
}

function checkModelSlugs(planText) {
  for (const match of planText.matchAll(modelSlugPattern)) {
    failures.push(`c: plan contains model slug ${match[0]}`);
  }
}

function checkPlanningBranch(planText) {
  const matches = [...planText.matchAll(planningBranchPattern)];
  if (matches.length > 0) {
    failures.push(`d: plan names planning/v0.1 as a branch ${matches.length} time(s)`);
  }
}

function checkVerificationSentence(planText) {
  const count = planText.split(verificationSentence).length - 1;
  if (count !== 1) {
    failures.push(
      `e: "Tests alone are not sufficient verification" appears ${count} times, expected 1`,
    );
  }
}

const planText = readDeliveryText(planPath);
const contractIndex = parseDeliveryJson(contractIndexPath, "contract-index.json");
parseDeliveryJson(phaseDataPath, "phase-data.json");
checkModelSlugPatternExamples();
checkBlanketAcceptance("autopilot-plan.md", planText);
checkBlanketAcceptance("phase-data.json", readDeliveryText(phaseDataPath));
parseDeliveryJson(lanePredicatesPath, "lane-predicates.json");

if (contractIndex) {
  checkFreezeAssignments(contractIndex);
  checkPlanReferences(planText, contractIndex);
  checkDeferredAcceptanceWording(contractIndex);
}
checkModelSlugs(planText);
checkPlanningBranch(planText);
checkVerificationSentence(planText);

if (failures.length > 0) {
  for (const failure of failures) {
    console.log(failure);
  }
  process.exit(1);
}

console.log("delivery plan consistent");
