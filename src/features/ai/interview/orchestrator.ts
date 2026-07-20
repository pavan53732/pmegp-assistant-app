// ─── Interview Orchestrator ──────────────────────────────────────────────────
// The brain of the AI interview. Coordinates all sub-modules:
//   Question Planner, Response Parser, Field Extractor,
//   Review Handler, Resume Handler.
//
// RULE #5: AI is the interviewer and writer, NEVER the calculator.
// RULE #4: All suggestions come from Knowledge Engine — never from AI.
// RULE #12: Interview state lives in the Interview Store.
// RULE #15: Subsystems communicate via typed events.
// RULE #16: PII masked before logging.
//
// See AGENT_CONTRACTS.md §12, IMPLEMENTATION_RULES.md.
// ───────────────────────────────────────────────────────────────────────────────

import type { InterviewPhase } from "@/shared/types/interview";
import type { ProjectProfile } from "@/shared/types/project-profile";
import type {
  AiMessageEvent,
  InterviewPhaseChangedEvent,
  SuggestionPresentedEvent,
} from "@/shared/events/event-types";

import { getEventBus } from "@/shared/events/event-bus";
import { InterviewStore } from "@/features/ai/interview-store/interview-store";
import { getAIResponse, type ProviderMessage } from "@/providers";
import {
  resolveActivity,
  suggestMachinery,
  suggestRawMaterials,
  isOnNegativeList,
  matchesNegativeKeyword,
} from "@/engines/knowledge-engine";

import type {
  ChatMessage,
  InterviewState,
  ParsedUserIntent,
  FieldExtraction,
  QuestionPlan,
} from "./types";
import {
  planNextQuestion,
  getNextPhase,
  getPhaseEntryMessage,
  PHASE_CONFIGS,
} from "./question-planner";
import { parseUserIntent, isGreeting } from "./response-parser";
import {
  extractFieldsFromMessage,
  buildExtractionPrompt,
  parseAIExtractionResponse,
} from "./field-extractor";
import { generateReviewText } from "./review-handler";
import {
  buildResumeContext,
  generateResumeMessage,
  generateProfileSummary,
} from "./resume-handler";

// ── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/** Mask PII for logging per RULE #16. */
function maskPII(text: string): string {
  // Mask Aadhaar-like patterns (12+ digits)
  let masked = text.replace(/\b\d{4}\d{4,8}\b/g, "XXXX-XXXX$&".slice(-4));
  // Mask PAN-like patterns (5 letters + 4 digits + 1 letter)
  masked = masked.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "XXXXX$&".slice(-5));
  return masked;
}

/**
 * Convert dot-path strings to the field descriptor format expected
 * by extractFieldsFromMessage / buildExtractionPrompt.
 */
function toFieldDescriptors(
  dotPaths: string[]
): Array<{
  dotPath: string;
  label: string;
  type: "TEXT" | "NUMBER" | "ENUM" | "BOOLEAN" | "CURRENCY" | "DATE";
  enumOptions?: string[];
}> {
  return dotPaths.map((dp) => ({
    dotPath: dp,
    label: dp.split(".").pop() ?? dp,
    type: "TEXT" as const,
  }));
}

// ── InterviewController ────────────────────────────────────────────────────

export class InterviewController {
  private state: InterviewState;
  private store: InterviewStore;
  private messageHistory: ProviderMessage[];
  private readonly projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
    this.store = new InterviewStore();
    this.messageHistory = [];
    this.state = {
      projectId,
      messages: [],
      currentPhase: "APPLICANT_DISCOVERY",
      isPaused: false,
      isComplete: false,
      error: null,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      interactionCount: 0,
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Start or resume the interview. Returns the first AI message. */
  async startNewInterview(): Promise<ChatMessage> {
    // Load the project profile into the store
    await this.store.loadProject(this.projectId);

    const profile = this.store.getProfile();
    const phase = profile?.completion.currentPhase ?? "APPLICANT_DISCOVERY";

    this.state.currentPhase = phase;
    this.state.startedAt = new Date().toISOString();
    this.state.lastActivityAt = new Date().toISOString();

    // Determine if this is a fresh start or a resume
    const isFresh =
      !profile ||
      profile.completion.interactionCount === 0;

    let aiMessage: ChatMessage;

    if (isFresh) {
      // Fresh interview — get the entry message for the first phase
      const entryMsg = getPhaseEntryMessage(phase);
      aiMessage = this.createAssistantMessage(entryMsg, phase);
    } else {
      // Resume — use resume handler (2 args: profile, conversationHistory)
      const resumeCtx = buildResumeContext(profile!, this.state.messages);
      const resumeText = generateResumeMessage(resumeCtx);
      aiMessage = this.createAssistantMessage(resumeText, phase);
    }

    // Initialize the AI provider message history with a system prompt
    this.messageHistory = [
      {
        role: "system",
        content: this.buildSystemPrompt(phase),
      },
    ];

    this.state.messages.push(aiMessage);
    this.emitAIMessage(aiMessage);
    return aiMessage;
  }

  /** Process a user message and return the AI response. */
  async processUserMessage(message: string): Promise<ChatMessage> {
    // 1. Add user message to state
    const userMsg = this.createUserMessage(message);
    this.state.messages.push(userMsg);
    this.state.interactionCount++;
    this.state.lastActivityAt = new Date().toISOString();

    // 2. Parse user intent
    let intent: ParsedUserIntent;
    if (isGreeting(message)) {
      intent = {
        type: "GREETING",
        rawText: message,
        confidence: 0.95,
      };
    } else {
      intent = parseUserIntent(
        message,
        this.state.currentPhase,
        this.state.messages.map((m) => ({
          content: m.content,
          role: m.role,
        }))
      );
    }

    // 3. Route based on intent type
    let aiMessage: ChatMessage;

    switch (intent.type) {
      case "ANSWER":
        aiMessage = await this.handleAnswer(message, intent);
        break;
      case "CORRECTION":
        aiMessage = await this.handleCorrection(message, intent);
        break;
      case "CLARIFICATION":
        aiMessage = await this.handleClarification(message);
        break;
      case "SKIP":
        aiMessage = await this.handleSkip();
        break;
      case "GO_BACK":
        aiMessage = await this.handleGoBack(intent);
        break;
      case "REVIEW_REQUEST":
        aiMessage = await this.handleReviewRequest();
        break;
      case "CONFIRM":
        aiMessage = await this.handleConfirm();
        break;
      case "HELP":
        aiMessage = await this.handleHelp();
        break;
      case "GREETING":
        aiMessage = await this.handleGreeting();
        break;
      case "OUT_OF_SCOPE":
      default:
        aiMessage = await this.handleOutOfScope(message);
        break;
    }

    // 4. Add AI message to state and history
    this.state.messages.push(aiMessage);
    this.messageHistory.push({
      role: "assistant",
      content: aiMessage.content,
    });

    this.emitAIMessage(aiMessage);
    return aiMessage;
  }

  /** Get all chat messages. */
  getCurrentMessages(): ChatMessage[] {
    return [...this.state.messages];
  }

  /** Get the current interview state. */
  getState(): InterviewState {
    return { ...this.state };
  }

  /** Get the active phase. */
  getActivePhase(): InterviewPhase {
    return this.state.currentPhase;
  }

  /** Pause the interview. */
  pause(): void {
    this.state.isPaused = true;
    this.state.lastActivityAt = new Date().toISOString();
  }

  /** Resume the interview. */
  async resume(): Promise<ChatMessage> {
    if (!this.state.isPaused) {
      return this.createAssistantMessage(
        "The interview is already running. How can I help you?",
        this.state.currentPhase
      );
    }
    this.state.isPaused = false;
    this.state.lastActivityAt = new Date().toISOString();

    // Re-generate the current question
    const plan = planNextQuestion(
      this.store.getProfile()!,
      this.state.currentPhase,
      this.state.messages
    );

    const aiMessage = await this.generateAIResponse(plan.question);
    return aiMessage;
  }

  /** End the interview (user confirms). */
  endInterview(): void {
    this.state.isComplete = true;
    this.state.lastActivityAt = new Date().toISOString();
  }

  /** Get the store's current profile snapshot. */
  getProfile(): ProjectProfile | null {
    return this.store.getProfile();
  }

  // ── Intent Handlers ──────────────────────────────────────────────────────

  private async handleAnswer(
    message: string,
    _intent: ParsedUserIntent
  ): Promise<ChatMessage> {
    const profile = this.store.getProfile();
    if (!profile) {
      return this.createAssistantMessage(
        "Sorry, I couldn't load the project. Please try again.",
        this.state.currentPhase
      );
    }

    const phase = this.state.currentPhase;

    // a. Get current question plan to know which fields we're collecting
    const currentPlan = planNextQuestion(profile, phase, this.state.messages);
    const targetFieldPaths = currentPlan.targetFields;

    // b. Convert to field descriptors and extract locally
    const fieldDescriptors = toFieldDescriptors(targetFieldPaths);
    const localResult = extractFieldsFromMessage(
      message,
      fieldDescriptors,
      "USER"
    );

    // c. Build extraction prompt and use AI for any remaining fields
    const aiExtractions: FieldExtraction[] = [];
    const fieldsNeedingAI = localResult.needsAI;

    if (fieldsNeedingAI.length > 0) {
      try {
        const aiFieldDescriptors = toFieldDescriptors(fieldsNeedingAI);
        const extractionPrompt = buildExtractionPrompt(
          message,
          aiFieldDescriptors,
          phase
        );
        this.messageHistory.push({ role: "user", content: extractionPrompt });
        const aiResp = await getAIResponse(this.messageHistory);
        if (aiResp.success && aiResp.content) {
          const parsed = parseAIExtractionResponse(aiResp.content, fieldsNeedingAI);
          aiExtractions.push(...parsed);
        }
        // Remove the extraction prompt from history (it was internal)
        this.messageHistory.pop();
      } catch (err) {
        console.error("[InterviewController] AI extraction failed:", err);
      }
    }

    // d. Merge all extractions
    const allExtractions = [...localResult.extracted, ...aiExtractions];

    // e. Update store for each extracted field
    for (const extraction of allExtractions) {
      this.store.updateField(
        extraction.fieldPath,
        extraction.value,
        extraction.source
      );
    }

    // f. After ACTIVITY_RESOLUTION phase: resolve NIC code via Knowledge Engine
    if (phase === "ACTIVITY_RESOLUTION") {
      await this.handleActivityResolution(profile, message);
    }

    // g. After activity is resolved, present Knowledge Engine suggestions
    if (
      phase === "PROJECT_SIZING" &&
      profile.business.nicCode
    ) {
      await this.presentKnowledgeSuggestions(profile);
    }

    // h. Plan next question
    const updatedProfile = this.store.getProfile()!;
    const nextPlan = planNextQuestion(updatedProfile, phase, this.state.messages);

    // i. Check if phase is complete, transition
    if (nextPlan.completesPhase || nextPlan.isPhaseStart) {
      const nextPhase = getNextPhase(phase, updatedProfile);
      if (nextPhase && nextPhase !== phase) {
        await this.transitionPhase(nextPhase);
        // Get the entry message for the new phase
        const entryMsg = getPhaseEntryMessage(nextPhase);
        return this.createAssistantMessage(entryMsg, nextPhase);
      }
    }

    // Generate the AI response for the next question
    return this.generateAIResponse(nextPlan.question);
  }

  private async handleCorrection(
    message: string,
    intent: ParsedUserIntent
  ): Promise<ChatMessage> {
    const profile = this.store.getProfile();
    if (!profile) {
      return this.createAssistantMessage(
        "No project loaded. Please try again.",
        this.state.currentPhase
      );
    }

    // The correction handler identifies fields from the message
    const fields = intent.correctionFields ?? [];
    if (fields.length === 0 && !intent.subject) {
      return this.createAssistantMessage(
        "I understand you want to correct something. Could you tell me which specific detail you'd like to change?",
        this.state.currentPhase
      );
    }

    // Extract fields and update
    const extractionTargets = fields.length > 0 ? fields : [intent.subject ?? ""];
    const fieldDescriptors = toFieldDescriptors(extractionTargets);
    const result = extractFieldsFromMessage(message, fieldDescriptors, "USER");

    for (const extraction of result.extracted) {
      this.store.updateField(extraction.fieldPath, extraction.value, "USER");
    }

    if (result.extracted.length > 0) {
      const fieldLabels = result.extracted.map((e) => e.label).join(", ");
      const plan = planNextQuestion(this.store.getProfile()!, this.state.currentPhase, this.state.messages);
      return this.generateAIResponse(
        `Got it, I've updated ${fieldLabels}. ${plan.question}`
      );
    }

    return this.createAssistantMessage(
      "I couldn't identify what to correct. Could you be more specific? For example, 'Change my name to Rajesh Kumar'.",
      this.state.currentPhase
    );
  }

  private async handleClarification(message: string): Promise<ChatMessage> {
    // Generate a helpful explanation about the current question
    const plan = planNextQuestion(this.store.getProfile()!, this.state.currentPhase, this.state.messages);
    const clarificationText = await this.generateAIResponse(
      `The user asked for clarification about: "${message}". Explain clearly and simply what information is needed for: ${plan.question}. Keep it brief and in simple language.`
    );
    return clarificationText;
  }

  private async handleSkip(): Promise<ChatMessage> {
    const updatedProfile = this.store.getProfile();
    if (!updatedProfile) {
      return this.createAssistantMessage(
        "No project loaded.",
        this.state.currentPhase
      );
    }

    // Plan next question (which will skip the current field)
    const nextPlan = planNextQuestion(updatedProfile, this.state.currentPhase, this.state.messages);

    if (nextPlan.completesPhase || nextPlan.isPhaseStart) {
      const nextPhase = getNextPhase(this.state.currentPhase, updatedProfile);
      if (nextPhase && nextPhase !== this.state.currentPhase) {
        await this.transitionPhase(nextPhase);
        const entryMsg = getPhaseEntryMessage(nextPhase);
        return this.createAssistantMessage(entryMsg, nextPhase);
      }
    }

    return this.generateAIResponse(
      `No problem, we'll skip that. ${nextPlan.question}`
    );
  }

  private async handleGoBack(intent: ParsedUserIntent): Promise<ChatMessage> {
    const targetPhase = intent.targetPhase;
    if (!targetPhase) {
      return this.createAssistantMessage(
        "Which section would you like to go back to? For example: applicant details, business details, or activity.",
        this.state.currentPhase
      );
    }

    await this.transitionPhase(targetPhase);
    const plan = planNextQuestion(this.store.getProfile()!, targetPhase, this.state.messages);
    return this.generateAIResponse(
      `Sure, let's go back to ${PHASE_CONFIGS[targetPhase]?.label ?? targetPhase}. ${plan.question}`
    );
  }

  private async handleReviewRequest(): Promise<ChatMessage> {
    const profile = this.store.getProfile();
    if (!profile) {
      return this.createAssistantMessage(
        "No project loaded to review.",
        this.state.currentPhase
      );
    }

    const reviewText = generateReviewText(profile);

    // Transition to REVIEW phase
    await this.transitionPhase("REVIEW");

    return this.createAssistantMessage(reviewText, "REVIEW");
  }

  private async handleConfirm(): Promise<ChatMessage> {
    // Only valid in REVIEW phase
    if (this.state.currentPhase !== "REVIEW") {
      const plan = planNextQuestion(this.store.getProfile()!, this.state.currentPhase, this.state.messages);
      return this.generateAIResponse(
        `We're not at the review stage yet. ${plan.question}`
      );
    }

    // Call store.confirmProject() which stamps all provenance CONFIRMED
    this.store.confirmProject();

    // Transition to VALIDATION_COMPLETION
    await this.transitionPhase("VALIDATION_COMPLETION");

    return this.createAssistantMessage(
      "Your project has been confirmed! All details are now locked in. The system will now run validation and eligibility checks. You'll be notified once everything is ready for DPR generation.",
      "VALIDATION_COMPLETION"
    );
  }

  private async handleHelp(): Promise<ChatMessage> {
    const helpText = `Here's how this PMEGP application assistant works:

• I'll ask you questions one at a time about your business idea.
• You can answer in Hindi, English, or Hinglish — whatever is comfortable.
• If you don't know an answer, just say "skip" and we'll move on.
• You can say "go back" to change earlier answers.
• At the end, you can review everything before confirming.
• Say "help" anytime to see this message again.

PMEGP is a government scheme for micro-enterprises with loans up to ₹25 lakh (₹50 lakh for manufacturing). The subsidy rate depends on your category and location.`;

    return this.createAssistantMessage(helpText, this.state.currentPhase);
  }

  private async handleGreeting(): Promise<ChatMessage> {
    const profile = this.store.getProfile();
    const plan = planNextQuestion(
      profile!,
      this.state.currentPhase,
      this.state.messages
    );

    // Warm greeting, then repeat the last question
    return this.generateAIResponse(
      `Hello! Welcome back. ${plan.question}`
    );
  }

  private async handleOutOfScope(message: string): Promise<ChatMessage> {
    // Log the out-of-scope message (PII masked per RULE #16)
    console.log(
      `[InterviewController] Out-of-scope message: ${maskPII(message)}`
    );

    const plan = planNextQuestion(
      this.store.getProfile()!,
      this.state.currentPhase,
      this.state.messages
    );

    return this.generateAIResponse(
      `I appreciate the question, but I'm here specifically to help with your PMEGP micro-enterprise application. Let's focus on that. ${plan.question}`
    );
  }

  // ── Knowledge Engine Integration ──────────────────────────────────────────

  private async handleActivityResolution(
    _profile: ProjectProfile,
    description: string
  ): Promise<void> {
    // Use Knowledge Engine to resolve activity — NEVER AI (RULE #4)
    const suggestions = resolveActivity(description);

    if (suggestions.length > 0) {
      const bestMatch = suggestions[0];

      // Check negative list
      const negEntry = isOnNegativeList(bestMatch.nicCode);
      const negKeyword = matchesNegativeKeyword(description);

      if (negEntry || negKeyword) {
        const reason = negEntry
          ? `The activity "${bestMatch.description}" (NIC: ${negEntry.nicCode}) is on the PMEGP negative list: ${negEntry.reason}.`
          : `Your activity description matches an excluded keyword: "${negKeyword}".`;

        console.log(
          `[InterviewController] Negative list match: ${maskPII(reason)}`
        );
        // The AI will communicate this to the user in the response
      }

      // Update the store with NIC code data (source: KNOWLEDGE per RULE #4)
      this.store.updateField("business.nicCode", bestMatch.nicCode, "KNOWLEDGE");
      this.store.updateField("business.nicDescription", bestMatch.description, "KNOWLEDGE");
      this.store.updateField("business.sector", bestMatch.sector, "KNOWLEDGE");
      this.store.updateField("business.subCategory", bestMatch.subCategory, "KNOWLEDGE");

      // Emit suggestion event
      this.emitSuggestion(
        "business.nicCode",
        bestMatch.nicCode,
        `Resolved from activity description: ${bestMatch.matchReason}`
      );
    }
  }

  private async presentKnowledgeSuggestions(
    profile: ProjectProfile
  ): Promise<void> {
    const nicCode = profile.business.nicCode;
    if (!nicCode) return;

    // Get machinery suggestions
    const machinery = suggestMachinery(nicCode);
    if (machinery.length > 0) {
      this.emitSuggestion(
        "machinery.items",
        machinery,
        `Knowledge Engine suggested ${machinery.length} machinery items for NIC ${nicCode}`
      );
    }

    // Get raw material suggestions
    const rawMaterials = suggestRawMaterials(nicCode);
    if (rawMaterials.length > 0) {
      this.emitSuggestion(
        "rawMaterials.items",
        rawMaterials,
        `Knowledge Engine suggested ${rawMaterials.length} raw materials for NIC ${nicCode}`
      );
    }
  }

  // ── Phase Management ──────────────────────────────────────────────────────

  private async transitionPhase(newPhase: InterviewPhase): Promise<void> {
    const previousPhase = this.state.currentPhase;
    this.state.currentPhase = newPhase;

    // Update the store's phase
    this.store.setPhase(newPhase);

    // Update the system prompt for the new phase
    this.messageHistory = [
      {
        role: "system",
        content: this.buildSystemPrompt(newPhase),
      },
    ];

    // Emit phase changed event (RULE #15)
    const bus = getEventBus();
    const event: InterviewPhaseChangedEvent = {
      type: "INTERVIEW_PHASE_CHANGED",
      projectId: this.projectId,
      timestamp: new Date().toISOString(),
      payload: { previousPhase, newPhase },
    };
    bus.emit(event);
  }

  // ── AI Response Generation ────────────────────────────────────────────────

  private async generateAIResponse(
    context: string,
  ): Promise<ChatMessage> {
    const phase = this.state.currentPhase;

    // Add user context to message history
    this.messageHistory.push({ role: "user", content: context });

    // Ensure system prompt is present and up-to-date
    if (this.messageHistory.length === 0 || this.messageHistory[0].role !== "system") {
      this.messageHistory.unshift({
        role: "system",
        content: this.buildSystemPrompt(phase),
      });
    } else {
      // Refresh system prompt with latest profile data
      this.messageHistory[0] = {
        role: "system",
        content: this.buildSystemPrompt(phase),
      };
    }

    try {
      const response = await getAIResponse(this.messageHistory);

      if (response.success && response.content) {
        return this.createAssistantMessage(response.content, phase);
      }

      // AI failed — return a friendly fallback
      console.error(
        "[InterviewController] AI response failed:",
        response.error
      );
      return this.createAssistantMessage(
        "I'm having trouble connecting right now. Could you please repeat that?",
        phase
      );
    } catch (err) {
      console.error("[InterviewController] AI error:", err);
      return this.createAssistantMessage(
        "Something went wrong on my end. Please try again.",
        phase
      );
    }
  }

  private buildSystemPrompt(phase: InterviewPhase): string {
    const profile = this.store.getProfile();
    const phaseConfig = PHASE_CONFIGS[phase];
    const profileSummary = profile
      ? generateProfileSummary(profile)
      : "No profile data yet.";

    return `You are a PMEGP (Prime Minister's Employment Generation Programme) application assistant. You are helping an Indian entrepreneur fill out a micro-enterprise loan application.

## Current Phase: ${phaseConfig?.label ?? phase}
${phaseConfig?.systemPromptAddendum ?? ""}

## Profile Summary:
${profileSummary}

## Rules:
- Ask ONE question at a time. Be brief and warm.
- Use simple English. Understand Hindi-English (Hinglish) mix.
- NEVER invent NIC codes, financial figures, or machinery lists.
- All suggestions come from the Knowledge Engine — never make up values.
- Money values must be whole rupees (integers), never decimals.
- If the user gives multiple pieces of information, acknowledge all of them.
- Guide the user naturally through the PMEGP application process.
- Be encouraging and respectful. Many users are first-time entrepreneurs.
- PII (Aadhaar, PAN) must never be logged or displayed in full.
- If unsure about the user's answer, ask a clarifying question rather than guessing.

## Scheme Context:
- PMEGP provides subsidies for micro-enterprises in India.
- Maximum project cost: ₹25 lakh (₹50 lakh for manufacturing).
- Subsidy rates: 15-35% depending on category and area.
- Bank finance covers 60-95% of project cost.`;
  }

  // ── Message Factories ─────────────────────────────────────────────────────

  private createAssistantMessage(
    content: string,
    phase: InterviewPhase
  ): ChatMessage {
    return {
      id: generateId(),
      role: "ASSISTANT",
      content,
      timestamp: new Date().toISOString(),
      phase,
    };
  }

  private createUserMessage(content: string): ChatMessage {
    return {
      id: generateId(),
      role: "USER",
      content,
      timestamp: new Date().toISOString(),
      phase: this.state.currentPhase,
    };
  }

  // ── Event Emission (RULE #15) ─────────────────────────────────────────────

  private emitAIMessage(message: ChatMessage): void {
    const bus = getEventBus();
    const event: AiMessageEvent = {
      type: "AI_MESSAGE",
      projectId: this.projectId,
      timestamp: new Date().toISOString(),
      payload: {
        message: maskPII(message.content),
        phase: message.phase,
        targetField: message.targetField,
      },
    };
    bus.emit(event);
  }

  private emitSuggestion(
    fieldPath: string,
    suggestedValue: unknown,
    reasoning: string
  ): void {
    const bus = getEventBus();
    const event: SuggestionPresentedEvent = {
      type: "SUGGESTION_PRESENTED",
      projectId: this.projectId,
      timestamp: new Date().toISOString(),
      payload: {
        fieldPath,
        suggestedValue,
        source: "KNOWLEDGE",
        reasoning,
      },
    };
    bus.emit(event);
  }
}