import fs from "node:fs/promises";
import path from "node:path";

const MODEL = process.env["README_TRANSLATION_MODEL"] || "openai/gpt-4.1-mini";
const API_URL = process.env["GITHUB_MODELS_API_URL"] || "https://models.inference.ai.azure.com/chat/completions";
const token = process.env["GITHUB_TOKEN"];

if (!token) {
  throw new Error("GITHUB_TOKEN is required for README translation workflow.");
}

const repoRoot = process.cwd();
const sourcePath = path.join(repoRoot, "README.md");
const targetPath = path.join(repoRoot, "README.zh-CN.md");

const source = await fs.readFile(sourcePath, "utf8");
const currentTarget = await fs.readFile(targetPath, "utf8").catch(() => "");

const systemPrompt = [
  "You are a technical translator for GitHub README files.",
  "Translate English Markdown content into Simplified Chinese.",
  "Requirements:",
  "- Keep all Markdown structure, links, image URLs, and code blocks intact.",
  "- Translate only human-readable prose.",
  "- Keep product names, file names, commands, and technical tokens unchanged.",
  "- Output only the translated Markdown document, no explanation.",
].join("\n");

const userPrompt = [
  "Translate the following README.md into Simplified Chinese.",
  "Return only the final Markdown content.",
  "\n--- BEGIN README ---\n",
  source,
  "\n--- END README ---",
].join("\n");

const response = await fetch(API_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    model: MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  }),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Translation request failed (${response.status}): ${body}`);
}

const data = await response.json();
const translated = data?.choices?.[0]?.message?.content?.trim();

if (!translated) {
  throw new Error("No translated content returned by model.");
}

await fs.writeFile(targetPath, `${translated}\n`, "utf8");

const changed = currentTarget !== `${translated}\n`;
const outputPath = process.env["GITHUB_OUTPUT"];
if (outputPath) {
  await fs.appendFile(outputPath, `changed=${changed}\n`, "utf8");
}

console.log(`[translate-readme-zh] README.zh-CN.md ${changed ? "updated" : "unchanged"}.`);
