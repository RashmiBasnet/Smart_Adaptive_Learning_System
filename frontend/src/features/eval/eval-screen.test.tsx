import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StudyModeProvider, type StudyMode } from "../../providers/study-mode-provider";
import type { EvalQuestionSet, EvalResult } from "../../lib/types/api";

// Navigation is mocked so the test can drive the slug + ?phase= directly. A
// hoisted object lets each test set the search string before rendering.
const nav = vi.hoisted(() => ({ slug: "stacks", search: "phase=PRE" }));
vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: nav.slug }),
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => `/eval/${nav.slug}`,
}));

// The api layer is mocked: the screen must never reach a real endpoint, and we
// assert on exactly what it sends.
vi.mock("../../lib/api/eval", () => ({
  getEvalQuestions: vi.fn(),
  submitEval: vi.fn(),
}));
import { getEvalQuestions, submitEval } from "../../lib/api/eval";
import { EvalScreen } from "../../app/eval/[slug]/page";

const questionSet: EvalQuestionSet = {
  conceptId: 3,
  conceptSlug: "stacks",
  conceptTitle: "Stacks",
  totalQuestions: 2,
  questions: [
    {
      id: 501,
      difficulty: "easy",
      stem: "First eval question",
      options: [
        { id: 9001, text: "Answer 1A" },
        { id: 9002, text: "Answer 1B" },
      ],
    },
    {
      id: 502,
      difficulty: "easy",
      stem: "Second eval question",
      options: [
        { id: 9003, text: "Answer 2A" },
        { id: 9004, text: "Answer 2B" },
      ],
    },
  ],
};

// Distinctive values that must NEVER surface to the participant.
const evalResult: EvalResult = {
  submissionId: 42,
  conceptSlug: "stacks",
  conceptTitle: "Stacks",
  correct: 7,
  total: 8,
};

function renderScreen(mode: StudyMode = "transparent") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StudyModeProvider initialMode={mode}>
        <EvalScreen />
      </StudyModeProvider>
    </QueryClientProvider>
  );
}

async function beginAndReachQuestions() {
  fireEvent.click(await screen.findByRole("button", { name: /Begin/ }));
  return screen.findAllByRole("radio");
}

describe("EvalScreen", () => {
  beforeEach(() => {
    vi.mocked(getEvalQuestions).mockReset().mockResolvedValue(questionSet);
    vi.mocked(submitEval).mockReset().mockResolvedValue(evalResult);
    nav.slug = "stacks";
    nav.search = "phase=PRE";
    localStorage.clear();
  });

  it("shows no feedback after submit — no score, no correct/incorrect, no result values", async () => {
    renderScreen();
    const radios = await beginAndReachQuestions();
    fireEvent.click(radios[0]); // Q1
    fireEvent.click(radios[2]); // Q2
    fireEvent.click(screen.getByRole("button", { name: /^Submit$/ }));

    await screen.findByText(/Response recorded/i);

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/score/i);
    expect(text).not.toMatch(/correct/i);
    expect(text).not.toMatch(/incorrect/i);
    // Neither the correct nor total value from the response leaks.
    expect(text).not.toContain("7");
    expect(text).not.toContain("8");
  });

  it("transmits the phase and study mode from the session on submit", async () => {
    nav.search = "phase=POST";
    renderScreen("transparent");
    const radios = await beginAndReachQuestions();
    fireEvent.click(radios[0]);
    fireEvent.click(radios[2]);
    fireEvent.click(screen.getByRole("button", { name: /^Submit$/ }));

    await waitFor(() => expect(submitEval).toHaveBeenCalledTimes(1));
    const [slug, phase, , studyMode] = vi.mocked(submitEval).mock.calls[0];
    expect(slug).toBe("stacks");
    expect(phase).toBe("POST");
    expect(studyMode).toBe("transparent");
  });

  it("blocks the test and never submits when phase is missing", async () => {
    nav.search = "";
    renderScreen();
    expect(await screen.findByText(/Missing or invalid \?phase=/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Begin/ })).not.toBeInTheDocument();
    expect(submitEval).not.toHaveBeenCalled();
  });

  it("blocks the test when phase is an invalid value", async () => {
    nav.search = "phase=middle";
    renderScreen();
    expect(await screen.findByText(/Missing or invalid \?phase=/)).toBeInTheDocument();
    expect(submitEval).not.toHaveBeenCalled();
  });

  it("submits unanswered questions as selectedOptionId null after one confirm", async () => {
    renderScreen();
    const radios = await beginAndReachQuestions();
    fireEvent.click(radios[0]); // answer Q1 only (501 -> 9001)

    // First submit: warns, does not send.
    fireEvent.click(screen.getByRole("button", { name: /^Submit$/ }));
    expect(submitEval).not.toHaveBeenCalled();
    expect(screen.getByText(/1 question unanswered/i)).toBeInTheDocument();

    // Second submit: sends, with the unanswered question as null.
    fireEvent.click(screen.getByRole("button", { name: /^Submit$/ }));
    await waitFor(() => expect(submitEval).toHaveBeenCalledTimes(1));
    const answers = vi.mocked(submitEval).mock.calls[0][2];
    expect(answers).toContainEqual({ questionId: 501, selectedOptionId: 9001 });
    expect(answers).toContainEqual({ questionId: 502, selectedOptionId: null });
  });

  it("renders identically in transparent and opaque mode", async () => {
    const t = renderScreen("transparent");
    await beginAndReachQuestions();
    const transparentHtml = t.container.innerHTML;
    t.unmount();

    const o = renderScreen("opaque");
    await beginAndReachQuestions();
    const opaqueHtml = o.container.innerHTML;

    expect(opaqueHtml).toBe(transparentHtml);
  });

  it("issues exactly one request when submit is double-clicked", async () => {
    // Keep the mutation pending so the button stays mounted for the second click.
    let resolve: (v: EvalResult) => void = () => {};
    vi.mocked(submitEval).mockReturnValue(
      new Promise<EvalResult>((r) => {
        resolve = r;
      })
    );
    renderScreen();
    const radios = await beginAndReachQuestions();
    fireEvent.click(radios[0]);
    fireEvent.click(radios[2]);

    const submitBtn = screen.getByRole("button", { name: /^Submit$/ });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    // The mutation fn runs on a microtask; the guard means the second click
    // never schedules a second run.
    await waitFor(() => expect(submitEval).toHaveBeenCalledTimes(1));
    expect(submitEval).toHaveBeenCalledTimes(1);
    resolve(evalResult);
  });
});
