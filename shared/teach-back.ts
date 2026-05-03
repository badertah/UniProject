// Shared teach-back quiz bank for SAD play-to-learn games.
// Imported by both client (UI) and server (verification) so the server can
// authoritatively check a submitted answer instead of trusting the client.

export interface TeachBackQ {
  prompt: string;
  options: string[];
  correctIndex: number;
  why: string;
}

export const SAD_GAME_TYPES = [
  "sdlc_sorter",
  "req_sorter",
  "usecase_builder",
  "erd_doctor",
  "dfd_detective",
  "sequence_stacker",
] as const;

export type SadGameType = (typeof SAD_GAME_TYPES)[number];

export function isSadGameType(value: string): value is SadGameType {
  return (SAD_GAME_TYPES as readonly string[]).includes(value);
}

export const TEACH_BACK_BANK: Record<SadGameType, TeachBackQ[]> = {
  sdlc_sorter: [
    {
      prompt: "Your team just wrote a unit test that verifies the login function rejects empty passwords. Which phase did this come from?",
      options: ["Planning", "Design", "Testing", "Maintenance"],
      correctIndex: 2,
      why: "Writing tests that VERIFY existing code is the Testing phase. Designing what the login should do would be Design.",
    },
    {
      prompt: "What's the LAST thing a phase produces before handing off to the next?",
      options: ["A meeting", "A deliverable", "A bug report", "An idea"],
      correctIndex: 1,
      why: "Each phase outputs concrete deliverables (a spec, a diagram, code, a test report) that feed the next phase.",
    },
  ],
  req_sorter: [
    {
      prompt: "'All passwords must be hashed with bcrypt before being saved.' — what kind of requirement?",
      options: ["Functional — saving is an action", "Non-functional — security/encryption is a quality"],
      correctIndex: 1,
      why: "Encryption is a security QUALITY of how data is stored, not a user-facing feature. Non-functional.",
    },
    {
      prompt: "'Customers can filter products by price range.' — what kind?",
      options: ["Functional — it's a feature the user invokes", "Non-functional — it's about the UI"],
      correctIndex: 0,
      why: "Filtering is a concrete user-facing action. Functional. (UI accessibility would be non-functional.)",
    },
  ],
  usecase_builder: [
    {
      prompt: "In an online shop, who is the actor for 'Process Refund Manually'?",
      options: ["Customer", "Admin / Support staff", "Shopping cart"],
      correctIndex: 1,
      why: "Customers REQUEST refunds, but PROCESSING them is an admin/support task. The shopping cart is part of the system, not an actor.",
    },
    {
      prompt: "Which of these is NOT a valid actor in a use case diagram?",
      options: ["A delivery driver", "A bank's payment API", "The 'orders' database table"],
      correctIndex: 2,
      why: "Database tables are INSIDE the system. Actors are external. Drivers and external APIs are external = actors.",
    },
  ],
  erd_doctor: [
    {
      prompt: "An Author can write many Books. Each Book has exactly one Author. What's the cardinality?",
      options: ["1:1", "1:N", "N:N"],
      correctIndex: 1,
      why: "One author → many books, but each book → one author. Classic 1-to-many.",
    },
    {
      prompt: "Books can be borrowed by many readers over time. Each reader can borrow many books. How would you model the relationship?",
      options: ["1:1 between Book and Reader", "1:N from Book to Reader", "N:N — needs a junction table (Loans)"],
      correctIndex: 2,
      why: "Both sides have many → N:N. You can't store this in either table directly; you need a Loans table linking them.",
    },
  ],
  dfd_detective: [
    {
      prompt: "Which connection is INVALID in a DFD?",
      options: ["Customer → Process Order", "Users DB → Sessions DB", "Login Process → Users DB"],
      correctIndex: 1,
      why: "Users DB → Sessions DB is store-to-store. A process (e.g. 'Create Session') must sit between them.",
    },
    {
      prompt: "Why must arrows in a DFD be LABELED?",
      options: ["So they look pretty", "Because the label IS the data being moved", "It's optional"],
      correctIndex: 1,
      why: "Every arrow carries some specific data (an order, a credit-card #, a session token). The label names that data.",
    },
  ],
  sequence_stacker: [
    {
      prompt: "In a flow with [User, LoginPage, AuthService, Database], the message 'AuthService verifies the password hash' lands in which lane?",
      options: ["User", "LoginPage", "AuthService — it's doing the work on itself", "Database"],
      correctIndex: 2,
      why: "When an object does work on ITSELF (a self-message), it lands in its OWN lane. AuthService is verifying — it stays in AuthService's lane.",
    },
    {
      prompt: "Why can't 'Database returns user record' come BEFORE 'AuthService asks Database for user'?",
      options: ["It's just style", "Causality — you can't reply to a question that hasn't been asked", "Random ordering is fine"],
      correctIndex: 1,
      why: "Sequence diagrams enforce causality. A reply must come after the request that triggers it. Always.",
    },
  ],
};
