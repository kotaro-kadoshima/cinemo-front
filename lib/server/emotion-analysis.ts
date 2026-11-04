import { generateText, Output } from "ai";
import { z } from "zod";
import { AI_CALL_OPTIONS, recommendModel } from "./ai";
import type { Emotion } from "./movie-search";

const INSTRUCTIONS = `あなたは感情を読み取るプロフェッショナルです。
質問から感情を読み取って、感情マスタから抽出してください。`;

const buildPrompt = (question: string, emotionList: string) => `# 指示
1. 「ユーザーの質問」の感情を分析
2. 「感情一覧」から近い感情を3つ抽出

## ユーザーの質問
${question}

## 感情一覧
${emotionList}
`;

/**
 * 気分の文章から、感情マスタの中で近い感情を最大3つ、近い順に返す。
 * 感情名はスキーマで感情マスタの名前に限定するので、マスタにない名前は返らない。
 */
export async function analyzeEmotions(question: string, master: Emotion[]): Promise<Emotion[]> {
  if (master.length === 0) return [];
  const names = master.map((e) => e.name) as [string, ...string[]];

  const schema = z.object({
    detectedEmotions: z.array(
      z.object({
        rank: z.number().int().describe("感情の順位（1が最も近い）"),
        emotion: z.enum(names).describe("感情一覧の中の感情名"),
        reason: z.string().describe("この感情と判断した理由（短く）"),
      }),
    ),
  });

  const { output } = await generateText({
    model: recommendModel(),
    instructions: INSTRUCTIONS,
    prompt: buildPrompt(question, `[${names.join(", ")}]`),
    output: Output.object({ schema }),
    ...AI_CALL_OPTIONS,
  });

  const byName = new Map(master.map((e) => [e.name, e]));
  const result: Emotion[] = [];
  for (const d of [...output.detectedEmotions].sort((a, b) => a.rank - b.rank)) {
    const emotion = byName.get(d.emotion);
    if (emotion && !result.some((e) => e.id === emotion.id)) result.push(emotion);
  }
  return result.slice(0, 3);
}
