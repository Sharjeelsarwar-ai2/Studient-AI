// Server-side prompt templates ported verbatim in substance from app.py.
// Prompts live here (server only) so document context is never exposed to the client bundle.
// Model: openai/gpt-oss-120b, temperature 0.2 (same as app.py).

export const MODEL = 'openai/gpt-oss-120b'
export const TEMPERATURE = 0.2

export const QUIZ_SYSTEM_MSG =
  'You are a quiz generation engine. Respond with ONLY valid JSON — ' +
  'no markdown, no code fences, no commentary. The JSON must be a list of objects ' +
  'with keys: "question" (string), "options" (object with keys A,B,C,D), ' +
  '"correct" (one of "A","B","C","D"), "explanation" (string), ' +
  '"topic" (short 2-4 word label). Base everything strictly on the material given.'

export const FLASHCARD_SYSTEM_MSG =
  'You are an educational visual flashcard generation engine. ' +
  'Respond with ONLY valid JSON — no markdown, no code fences, no commentary. ' +
  'The JSON must be a list of objects with these keys: ' +
  '"front" (a concise question or concept, ideally under 12 words), ' +
  '"topic" (a short 2-4 word label), ' +
  '"visual_type" (one of: definition, process, comparison, timeline, formula, fact), ' +
  '"visual_title" (a short title for the visual), ' +
  '"visual_items" (an array of 2-6 short strings containing the key information needed ' +
  'to understand the concept visually). ' +
  'Choose the visual_type that best represents the concept. ' +
  'For process use ordered steps. ' +
  'For comparison, visual_items MUST contain at least one item for the first concept, ' +
  'then a standalone item that is exactly \'VS\' (nothing else on that item), then at least ' +
  'one item for the second concept — for example: ["Side A point 1", "Side A point 2", "VS", ' +
  '"Side B point 1", "Side B point 2"]. Never omit the standalone \'VS\' item, and never leave ' +
  'either side with zero items. ' +
  'For timeline use chronological events. ' +
  'For formula use the important equation or relationship. ' +
  'For definition use the central concept plus supporting points. ' +
  'For fact use the most important fact or relationship. ' +
  'Keep visual_items concise and easy to display in a diagram. ' +
  'Base everything strictly on the study material. Do not invent facts.'

export const MIND_MAP_SYSTEM_MSG =
  'You are an educational mind map architect. Respond with ONLY valid JSON — no markdown, ' +
  'no code fences, no commentary. Return one object with keys: title (string) and children (array). ' +
  'Every node is an object with label (short string) and children (array of nodes). ' +
  'Create a useful hierarchy from the supplied study material: 4-7 major branches, each with 2-5 ' +
  'supporting concepts, and deeper nodes only when genuinely useful. Keep labels concise. ' +
  'Base every node strictly on the material and do not invent facts.'

const SUMMARY_STYLE = {
  Brief: 'Keep the final guide compact but cover every major topic, definition, formula, and process.',
  Detailed: 'Explain every major topic clearly, including intuition, definitions, steps, examples, formulas, variables, and exam traps.',
  'Exam-focused': 'Prioritize likely quiz and university-exam material: definitions, distinctions, protocols, steps, formulas, examples, common confusions, and quick recall points.',
}

export function summaryBatchPrompt(index, total, batch) {
  return `You are building reliable study notes from source sections ${index} of ${total}.
Extract all meaningful topics and facts in this batch. Preserve slide/page order and labels.
For each academic topic include: topic name, accurate definition, purpose, intuitive explanation, key properties, formulas with variables and units when present, examples, and likely exam confusion. Exclude slide-use/licensing policies, copyright notices, author or publisher information, lecture roadmaps, chapter goals, decorative headings, and other administrative metadata from the topic explanations unless they contain a substantive concept from this material's actual subject.
For every process, protocol, algorithm, mechanism, architecture flow, or workflow, explain it as a numbered sequence: starting conditions or inputs -> each step in order -> decisions/branches -> intermediate state or data movement -> final output/result. Also explain why each step happens, what problem it solves, and what can go wrong. Never reduce a process to a one-line label.
Do not invent information. If a formula, definition, or visual-only claim is not readable, say 'not stated in the extracted text'.
Return structured markdown notes only.

SOURCE BATCH:
${batch.slice(0, 14000)}`
}

export function summaryFinalPrompt(detailLevel, focus, evidence) {
  const style = SUMMARY_STYLE[detailLevel] || 'Explain every major topic clearly.'
  return `Create the final ${detailLevel.toLowerCase()} study guide for a student preparing for a quiz on this material. Base the subject, terminology, and scope strictly on the source-batch notes below — do not assume any particular course or field (it may or may not be about computer networks, software engineering, or any other topic; follow the actual content).
${style}
${focus ? 'Focus especially on: ' + focus : ''}

Use all source-batch notes below. Do not drop topics merely because they appeared in a later batch. Merge duplicates, keep important distinctions, and explicitly cover the full material. The source batches are complete; never write phrases such as “later slides not provided” or “remaining slides missing”, and never invent slide ranges that are not present in the source.
Use this structure:
1. Course/lecture overview
2. Complete academic topic map (every major topic in source order; omit administrative slide material)
3. Topic explanations with clear definitions and intuition
4. Protocols, architectures, processes, and step-by-step mechanisms
5. All formulas/equations, with every symbol, unit, and when-to-use explanation
6. Comparisons and common confusions
7. Examples and applications
8. Quiz-ready facts and likely questions
9. Final one-page rapid revision sheet

For Brief mode, keep the response concise: give one or two lines per academic topic, include a compact definition or purpose, list formulas by name, and finish with “Suggested next topics to explain”. Do not expand every workflow yet. For Detailed or Exam-focused mode, expand the mechanisms fully.
Use polished markdown with headings, tables where useful, bullets, bold terms, and numbered workflow blocks. For expanded workflows use: **Purpose**, **Inputs**, **Step-by-step operation**, **Output**, **Why it matters**, and **Common failure or exam trap**. For formulas use: **Formula**, **Variables**, **Units**, **Meaning**, and **Example/use case**. Ground every claim in the extracted notes; mark genuinely unreadable details rather than guessing.

SOURCE-BATCH NOTES:
${evidence.slice(0, 24000)}`
}

export function suggestionsPrompt(summaryText, topicMapText = '') {
  return `Below is a study summary generated from a student's uploaded material. Suggest exactly 3 short, specific follow-up study actions a student could take next, each one in English and drawn from topics that ACTUALLY appear in this summary (never invent a topic that is not present).

Return ONLY a valid JSON array of 3 objects shaped like:
{"label": "short button label with one emoji, max 4 words", "request": "a full natural-language study request, e.g. 'Explain X in more depth with an example'"}

Vary the three: e.g. one asks to go deeper on a specific topic named in the summary, one asks about a comparison/common confusion if the summary has one, one asks for a short practice quiz on the material. Use the real topic names from the summary, not generic placeholders.

SUMMARY:
${summaryText.slice(0, 6000)}
${topicMapText.slice(0, 2000)}`
}

export function explainTopicPrompt(topic, context) {
  return `Explain the topic below as a focused follow-up lesson, strictly using the subject matter of the source material provided (whatever course or field it is — do not assume any particular subject).
Topic requested: ${topic}

Use the source material as the primary authority. Include:
1. A clear definition and intuition
2. Why the topic matters
3. Inputs and assumptions
4. Step-by-step process, protocol, mechanism, or workflow if applicable
5. Formula(s), variables, and a small worked example if present. Write formulas in readable plain text, for example: d_trans = L / R, not LaTeX commands such as \\frac{L}{R}.
6. A comparison or common confusion
7. If the request asks for a quiz, provide exactly the requested number of questions with four options, correct answers, and explanations. Otherwise provide three quick-check questions with short answers.

Do not discuss unrelated topics or claim that slides are missing. If the extracted material does not state a detail, say so clearly.

SOURCE CONTEXT:
${context}`
}

export function videoPlanPrompt({ videoFormat, language, topic, visualStyle, context }) {
  return `Create a NotebookLM-style educational video overview plan grounded strictly in the uploaded study material below, covering whatever subject it actually is (do not assume any particular course or field).
Format: ${videoFormat}
Spoken language: ${language}
Topic: ${topic}
Visual style: ${visualStyle}

Return polished markdown containing:
1. Video title and learning objective
2. Approximate duration and audience. The finished narration must be 6–9 minutes and never over 10 minutes.
3. A teacher-led narration script in the requested spoken language (${language}), limited to about 900–1100 spoken words. Start by defining the key concepts, then explain how they connect, then walk through one or two mechanisms or examples, and finish with a recap. Write only words the teacher should say in this section: no timestamps, emojis, markdown headings, labels, stage directions, metadata, or visual instructions.
4. A scene-by-scene storyboard with scene duration, narration, on-screen text, visual treatment, and transition
5. Step-by-step visual treatment for every process, protocol, mechanism, or workflow
6. Formula cards with readable plain-text equations such as d_trans = L / R, plus variable meanings
7. Three recap takeaways and three quiz questions

Keep on-screen text short and readable. Use diagrams or flow arrows for processes, comparison cards for contrasts, animated formula reveals, and a layered stack visual where useful. The teacher must explain ideas rather than read a list of slide titles. Exclude copyright notices, slide-use policy, lecture administration, timestamps, emojis, and irrelevant metadata from narration. Do not invent facts; state when the uploaded material does not provide a detail.

WORKSPACE CONTEXT:
${context}`
}

export function videoNarrationPrompt(plan, language) {
  return `Extract or rewrite the teacher narration from the video plan below.
Return ONLY the words the teacher should speak. Do not include a title, headings, timestamps, scene labels, emojis, bullets, numbering, visual directions, audience notes, copyright information, or calls to download anything.
    Teach in this order: define the key concepts first; connect them into one mental model; explain the most important process or mechanism step by step; explain one formula or example if present; finish with three short recap ideas. Sound like a patient university instructor, using transitions and intuition instead of reading a list. Use short sentences and natural pauses after definitions and formulas. Pronounce technical terms clearly: say abbreviations such as IP, TCP, and DNS as separate letters when appropriate, and say formulas in words as well as symbols.
The narration must be about 900–1100 words, suitable for a 6–9 minute video and never more than 10 minutes. Use plain readable spoken language. Keep technical terms and formulas accurate.
Requested language: ${language}
VIDEO PLAN:
${plan.slice(0, 26000)}`
}

export function storyboardPrompt(spoken, topic, language, contentCount) {
  return `You are designing the ON-SCREEN SLIDES for a short teaching video. The narration has already been written (given below only so your slides follow its order) — do not copy it verbatim onto the slides.

Return ONLY a valid JSON array of exactly ${contentCount} objects, each shaped like:
{"title": "short slide heading, max 6 words", "bullets": ["short on-screen phrase, max 8 words", "...", "3 to 4 bullets per slide"]}

Write every "title" and "bullets" value in ${language}. Order the slides the way a teacher would build the lesson: key definitions first, then how the ideas connect, then the main process or mechanism step by step, then a formula or worked example if the narration has one, then a short recap. Bullets are short on-screen key terms/phrases a student reads while the teacher talks — never full sentences, never narration text copied verbatim.

TOPIC: ${topic}
NARRATION (for ordering/grounding only):
${spoken.slice(0, 6000)}`
}

export function quizPrompt(count, difficulty, category, context) {
  const categoryFocus = { Mixed: 'important exam concepts facts definitions processes', Definitions: 'definitions terms meanings', Processes: 'processes mechanisms steps cause effect', Comparisons: 'comparisons differences similarities', Facts: 'important facts values examples', 'Exam-focused': 'high priority exam concepts likely questions' }[category] || 'important concepts'
  void categoryFocus
  return `Create exactly ${count} multiple-choice questions at ${difficulty} difficulty in the ${category} category
from the study material below. Return ONLY the JSON array described in the system message. 

STUDY MATERIAL: 
${context} 
`
}

export function flashcardsPrompt(count, difficulty, context) {
  return `Create exactly ${count} visual study flashcards at ${difficulty} depth.

Each flashcard must turn an important concept from the material into a visual learning artifact.

Requirements:
- "front" = concise question or concept, ideally under 12 words.
- "topic" = short 2-4 word category.
- "visual_type" = definition, process, comparison, timeline, formula, or fact.
- "visual_title" = short title.
- "visual_items" = 2-6 concise pieces of information.
- Do NOT create generic or unrelated visuals.
- Use a process visual when the material describes steps.
- Use comparison when two concepts are contrasted.
- Use timeline when events/stages have chronological order.
- Use formula when an equation or relationship is important.
- Use definition for concepts that are best understood through a central idea.
- Use fact for an important relationship, value, or memorable fact.

Return ONLY the JSON array described in the system message.

STUDY MATERIAL:
${context}
`
}

export function mindMapPrompt(context) {
  return `Build a hierarchical interactive mind map for the study material below.

The root title should describe the overall document or subject. Organize the most important ideas into
clear branches suitable for revision. Prefer meaningful relationships over a long list of isolated facts.
Return ONLY the JSON object described in the system message.

STUDY MATERIAL:
${context}
`
}

export function studyPlanPrompt({ examDate, daysLeft, targetGrade, hoursPerDay, weakSubjects, schedule, context }) {
  return `Create a practical personalized study plan grounded in the workspace material below.
Exam date: ${examDate} (${daysLeft} days from today)
Target grade: ${targetGrade}
Available study time: ${hoursPerDay} hours per day
Weak subjects or topics: ${weakSubjects || 'Identify from the material'}
Preferred schedule: ${schedule}

Include: a clear phase overview, daily tasks, revision blocks, practice tests, flashcard reviews, rest/buffer days, and a final revision plan. Keep tasks realistic for the available time. Use markdown headings and a day-by-day table where useful.

WORKSPACE MATERIAL:
${context}`
}

export function tutorPrompt({ question, level, mode, previous, context }) {
  return `You are Studient AI Tutor. Teach using the workspace material as the primary source.
Student level: ${level}
Tutor mode: ${mode}
Student question: ${question}
Recent conversation:
${previous}

Rules:
- In Socratic mode, do not immediately reveal the final answer. Ask one guiding question and give a small hint.
- In Hint mode, give a progressive hint, then ask the student to try again.
- In Explain mode, explain clearly at the student's level and offer a second analogy or representation.
- Detect likely misconceptions and label them gently as "Possible misconception" when relevant.
- If the workspace does not contain the answer, say so instead of inventing a document fact.
- End with one short check-for-understanding question.

WORKSPACE CONTEXT:
${context}`
}

const MATERIAL_INSTRUCTIONS = {
  'Cheat sheet': 'Create a concise exam-ready cheat sheet with headings, key facts, definitions, processes, formulas, and common mistakes.',
  'Formula sheet': 'Extract and explain every important formula, define each variable, state units, and include when to use it.',
  Glossary: 'Create a glossary of the most important terms with clear one-to-two sentence definitions and examples.',
  'Concept comparison table': 'Create a markdown comparison table of the most important related concepts, including similarities, differences, use cases, and exam traps.',
  'Timeline summary': 'Create a chronological timeline with dates or sequence markers, events, causes, consequences, and memory cues.',
  'Case studies': 'Create realistic case studies based only on the workspace, followed by analysis questions and model reasoning.',
  'Lab-viva questions': 'Create laboratory viva questions with concise model answers, safety notes, observations, and common examiner follow-ups.',
  'Oral examination questions': 'Create oral examination questions from easy to difficult, with ideal answer points and follow-up questions.',
}

export function materialPrompt(materialType, focus, difficulty, context) {
  return `${MATERIAL_INSTRUCTIONS[materialType] || MATERIAL_INSTRUCTIONS['Cheat sheet']}
Difficulty/depth: ${difficulty}
Focus: ${focus || 'all important topics'}
Return polished markdown suitable for a student to revise directly. Ground every factual claim in the workspace material and say when the material does not provide an answer.

WORKSPACE MATERIAL:
${context}`
}

export function samplePaperPrompt({ durationMinutes, totalMarks, difficulty, sectionMix, instructions, context }) {
  return `Create a complete university examination sample paper based strictly on the study material below.
Duration: ${durationMinutes} minutes
Total marks: ${totalMarks}
Difficulty: ${difficulty}
Requested sections: ${sectionMix}
Additional instructions: ${instructions || 'Use a balanced university exam format.'}

Return polished markdown with:
1. University-style title, instructions, duration, total marks, and suggested time allocation.
2. Clearly numbered sections and questions with marks per question.
3. A balanced mix of important questions from across the entire material, not just one chapter.
4. Optional choices where appropriate.
5. A separate answer key/model-answer section after the paper with concise marking points and explanations.
6. A topic coverage note showing which major topics were tested.

Avoid invented facts. If the material lacks enough information for a question, omit it and use another supported concept.

FULL WORKSPACE STUDY MATERIAL:
${context}`
}

export function importantQuestionsPrompt(count, difficulty, context) {
  return `Create ${count} important university exam questions from the material below. 
Difficulty: ${difficulty}. Prioritize core concepts, processes, definitions, comparisons, cause and effect. 
Return numbered questions only. 
 
STUDY MATERIAL: 
${context}`
}

export function longQuestionsPrompt(count, difficulty, context) {
  return `Create ${count} long-answer university examination questions. 
Difficulty: ${difficulty}. Focus on Explain / Discuss / Analyze / Compare / Describe processes / Cause and effect. 
Return only numbered questions. 
 
STUDY MATERIAL: 
${context}`
}

export function shortQuestionsPrompt(count, context) {
  return `Create ${count} short-answer questions from this study material. 
Focus on Definitions / Facts / Important terms / Differences / Basic concepts. 
Return only numbered questions. 
 
STUDY MATERIAL: 
${context}`
}

export function conceptsPrompt(context) {
  return `Identify the most important concepts in the study material. 
For every concept provide: CONCEPT / Short explanation / Why it matters for the exam. 
 
STUDY MATERIAL: 
${context}`
}

export function difficultyPrompt(context) {
  return `Analyze the difficulty of this study material. Provide: 
1. Overall difficulty 2. Easy topics 3. Medium topics 4. Difficult topics 
5. Concepts requiring memorization 6. Concepts requiring deep understanding 
7. Topics most likely to challenge students 8. Recommended study priority. 
 
STUDY MATERIAL: 
${context}`
}

export function askPrompt({ question, context, useGeneralKnowledge }) {
  if (useGeneralKnowledge) {
    return `The student uploaded the document below and is asking a question that may go 
beyond what the document literally states (e.g. asking for improvements, opinions, or ideas). 
 
Answer helpfully using BOTH the document and your own general knowledge. Structure your answer 
in two clearly labeled parts: 
 
📄 From your document: 
(what the document itself says that's relevant — if nothing is relevant, say so briefly) 
 
💡 Suggestions / general knowledge: 
(your own ideas, recommendations, or knowledge that goes beyond the document — be specific and practical) 
 
Do not present your own knowledge as if it came from the document. 
 
DOCUMENT CONTENT: 
${context} 
 
STUDENT QUESTION: 
${question}`
  }
  return `Answer the student's question using ONLY the information in the provided workspace material. 
If the answer cannot be found, say clearly: "The answer is not available in the uploaded PDF." 
Do not invent facts. Explain clearly, use bullet points if useful. 
 
WORKSPACE MATERIAL: 
${context} 
 
STUDENT QUESTION: 
${question}`
}

export function translateSummaryPrompt(cleaned, languageName) {
  return `Translate the study summary below into natural, clear ${languageName} for spoken audio. Preserve all factual meaning. Return only the translated study content without an introduction, headings, markdown, bullets, symbols, or commentary.\n\nSUMMARY:\n${cleaned.slice(0, 12000)}`
}

// Token budgets copied from app.py per task.
export const MAX_TOKENS = {
  summaryBriefBatch: 800,
  summaryExamBatch: 1300,
  summaryDetailedBatch: 1700,
  summaryBrief: 3000,
  summaryExam: 4800,
  summaryDetailed: 5600,
  suggestions: 500,
  explainTopic: 2600,
  videoPlan: 5200,
  videoNarration: 2600,
  storyboard: 1700,
  quiz: 4000,
  flashcards: 2500,
  mindmap: 3500,
  studyPlan: 4200,
  tutor: 1800,
  material: 3600,
  samplePaper: 6500,
  questions: 1800,
  concepts: 2600,
  difficulty: 2600,
  ask: 2500,
  translateSummary: 3500,
}
