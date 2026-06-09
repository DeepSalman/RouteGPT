import {
  Bookmark,
  Check,
  Clock3,
  Flag,
  Loader2,
  Plus,
  SendHorizontal,
  Settings,
  UserCircle,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDemoChatResponse } from "./demoResponses.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const examplePrompts = [
  "Gabtoli to Mirpur 1",
  "Bashundhara theke Jatrabari bus",
  "Gulshan to Dhanmondi CNG"
];

const loadingMessages = [
  "Reading your route request...",
  "Checking matching transport options...",
  "Calculating fares..."
];

const initialAccount = {
  name: "User Name",
  email: "user@example.com",
  student: "Yes",
  preferredLanguage: "Banglish"
};

function createUserMessage(content) {
  return {
    id: crypto.randomUUID(),
    role: "user",
    content
  };
}

function createAssistantMessage(content, cards = [], tone = "normal") {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    cards,
    tone
  };
}

async function sendChatMessage(message) {
  if (IS_DEMO_MODE) {
    return getDemoChatResponse(message);
  }

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.ok) {
    const error = new Error(body?.error || "RouteGPT could not answer this route yet.");
    error.status = response.status;
    throw error;
  }

  return body;
}

function getFriendlyChatError(error) {
  if (error?.status === 400) {
    return error.message || "Please enter a route question with a starting point and destination.";
  }

  if (
    error instanceof TypeError ||
    /failed to fetch|network|load failed/i.test(error?.message || "")
  ) {
    return `I can't reach the RouteGPT backend right now. Start it with npm run dev:backend, then try again.`;
  }

  return "I couldn't finish this route request. Please try again in a moment.";
}

function formatMoney(value, currency = "BDT") {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return `${currency} --`;
  }

  return `${currency} ${Math.round(value)}`;
}

function formatFareRange(range, currency = "BDT") {
  if (!range || typeof range.min !== "number" || typeof range.max !== "number") {
    return `~${currency} --`;
  }

  return `~${currency} ${Math.round(range.min)}-${Math.round(range.max)}`;
}

function formatDistance(card) {
  const parts = [];

  if (typeof card.distanceKm === "number") {
    parts.push(`${card.distanceKm} km`);
  }

  if (typeof card.durationMin === "number") {
    parts.push(`${card.durationMin} min`);
  }

  return parts.join(" - ");
}

function getReportKey(card, index) {
  const route = card.route || {};

  return [
    card.type,
    card.provider,
    card.vehicle,
    card.busId,
    route.originStopName,
    route.destinationStopName,
    index
  ]
    .filter(Boolean)
    .join(":");
}

function Sidebar({ onNewChat }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">Dhaka Transport Assistant</div>

      <nav className="sidebar-nav" aria-label="Main">
        <button className="nav-item nav-item-active" type="button" onClick={onNewChat}>
          <Plus size={22} />
          <span>New Chat</span>
        </button>
        <button className="nav-item" type="button">
          <Clock3 size={22} />
          <span>History</span>
        </button>
        <button className="nav-item" type="button">
          <Bookmark size={22} />
          <span>Saved Routes</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" type="button">
          <Settings size={22} />
          <span>Settings</span>
        </button>
        <div className="user-row">
          <UserCircle size={28} />
          <div>
            <strong>User Name</strong>
            <span>Local account</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Header({ onAccountClick }) {
  return (
    <header className="topbar">
      <strong>RouteGPT</strong>
      <button
        className="icon-button"
        type="button"
        aria-label="Open account information"
        onClick={onAccountClick}
      >
        <UserCircle size={26} />
      </button>
    </header>
  );
}

function EmptyState({ onPromptClick }) {
  return (
    <section className="empty-state" aria-label="Example route prompts">
      <h1>Where do you want to go?</h1>
      <div className="prompt-grid">
        {examplePrompts.map((prompt) => (
          <button
            className="prompt-card"
            type="button"
            key={prompt}
            onClick={() => onPromptClick(prompt)}
          >
            <span>{prompt}</span>
            <span aria-hidden="true">-&gt;</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ReportButton({ reportKey }) {
  const [isReported, setIsReported] = useState(false);

  return (
    <div className="report-control" data-report-key={reportKey}>
      <button
        className="report-button"
        type="button"
        disabled={isReported}
        onClick={() => setIsReported(true)}
      >
        {isReported ? <Check size={15} /> : <Flag size={15} />}
        <span>{isReported ? "Reported" : "Report wrong info"}</span>
      </button>
      {isReported && <span className="report-confirmation">Thanks, we received your report.</span>}
    </div>
  );
}

function BusResultCard({ card, index }) {
  const currency = card.fare?.currency || "BDT";
  const origin = card.route?.originStopName || "Origin";
  const destination = card.route?.destinationStopName || "Destination";
  const stationCount = card.route?.stationCount;

  return (
    <article className="result-card result-card-bus">
      <header className="result-card-header">
        <span className="result-mode">Bus</span>
        <strong>{card.title || "Bus option"}</strong>
      </header>

      <dl className="fare-grid">
        <div>
          <dt>Fare</dt>
          <dd>{formatMoney(card.fare?.general, currency)}</dd>
        </div>
        <div>
          <dt>Student</dt>
          <dd>{formatMoney(card.fare?.student, currency)}</dd>
        </div>
      </dl>

      <p className="route-summary">
        {origin} -&gt; {destination}
      </p>

      <div className="result-meta">
        {typeof stationCount === "number" && <span>{stationCount} stops</span>}
        {card.subtitle && <span>{card.subtitle}</span>}
      </div>

      <ReportButton reportKey={getReportKey(card, index)} />
    </article>
  );
}

function CngResultCard({ card, index }) {
  const distance = formatDistance(card);

  return (
    <article className="result-card">
      <header className="result-card-header">
        <span className="result-mode">CNG</span>
        <strong>{formatMoney(card.fare?.amount, card.fare?.currency || "BDT")}</strong>
      </header>

      {distance && <p className="route-summary">{distance}</p>}
      <p className="result-note">
        {card.fare?.isNight ? "Night fare estimate included." : "Distance-based estimate."}
      </p>

      <ReportButton reportKey={getReportKey(card, index)} />
    </article>
  );
}

function RideResultCard({ card, index }) {
  const distance = formatDistance(card);

  return (
    <article className="result-card">
      <header className="result-card-header">
        <span className="result-mode">{card.provider === "uber" ? "Uber" : "Pathao"}</span>
        <strong>{card.title || "Ride estimate"}</strong>
      </header>

      <p className="result-price">{formatFareRange(card.fareRange, card.currency || "BDT")}</p>
      {distance && <p className="route-summary">{distance}</p>}
      <p className="result-note">{card.note || "Actual app fare may vary."}</p>

      <ReportButton reportKey={getReportKey(card, index)} />
    </article>
  );
}

function ResultCard({ card, index }) {
  if (card.type === "bus") {
    return <BusResultCard card={card} index={index} />;
  }

  if (card.type === "cng") {
    return <CngResultCard card={card} index={index} />;
  }

  return <RideResultCard card={card} index={index} />;
}

function ResultCards({ cards }) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return null;
  }

  return (
    <div className="result-card-list" aria-label="Transport result cards">
      {cards.map((card, index) => (
        <ResultCard key={getReportKey(card, index)} card={card} index={index} />
      ))}
    </div>
  );
}

function ChatMessage({ message }) {
  const hasCards = Array.isArray(message.cards) && message.cards.length > 0;
  const toneClass = message.tone === "error" ? " message-error" : "";

  return (
    <article
      className={`message message-${message.role}${hasCards ? " message-with-cards" : ""}${toneClass}`}
    >
      <div className="message-stack">
        {message.content && (
          <div className="message-bubble">
            <p>{message.content}</p>
          </div>
        )}
        <ResultCards cards={message.cards} />
      </div>
    </article>
  );
}

function Composer({ value, disabled, onChange, onSubmit }) {
  return (
    <form className="composer" aria-busy={disabled} onSubmit={onSubmit}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={disabled ? "Finding route options..." : "Ask a route..."}
        aria-label="Ask a route"
      />
      <button className="send-button" type="submit" disabled={disabled || !value.trim()}>
        {disabled ? <Loader2 className="spin" size={22} /> : <SendHorizontal size={22} />}
        <span className="sr-only">Send</span>
      </button>
    </form>
  );
}

function AccountModal({ account, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="account-title">Account Information</h2>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={24} />
          </button>
        </header>
        <dl>
          <div>
            <dt>Name:</dt>
            <dd>{account.name}</dd>
          </div>
          <div>
            <dt>Email:</dt>
            <dd>{account.email}</dd>
          </div>
          <div>
            <dt>Student:</dt>
            <dd>{account.student}</dd>
          </div>
          <div>
            <dt>Preferred Language:</dt>
            <dd>{account.preferredLanguage}</dd>
          </div>
        </dl>
        <button className="primary-button" type="button">
          Edit Profile
        </button>
      </section>
    </div>
  );
}

function LoadingMessage({ step }) {
  return (
    <article className="message message-assistant">
      <div className="message-stack">
        <div className="message-bubble typing">
          <Loader2 className="spin" size={18} />
          <span>{loadingMessages[step]}</span>
          <span className="typing-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isSending) {
      setLoadingStep(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setLoadingStep((current) => (current + 1) % loadingMessages.length);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [isSending]);

  async function submitMessage(event) {
    event.preventDefault();

    const content = draft.trim();
    if (!content || isSending) return;

    setDraft("");
    setMessages((current) => [...current, createUserMessage(content)]);
    setIsSending(true);

    try {
      const result = await sendChatMessage(content);
      setMessages((current) => [
        ...current,
        createAssistantMessage(result.reply || "RouteGPT found a response.", result.cards || [])
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createAssistantMessage(getFriendlyChatError(error), [], "error")
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setDraft("");
  }

  function usePrompt(prompt) {
    setDraft(prompt);
  }

  return (
    <div className="app-layout">
      <Sidebar onNewChat={startNewChat} />
      <div className="main-panel">
        <Header onAccountClick={() => setIsAccountOpen(true)} />

        <main className="chat-area" ref={scrollRef}>
          {messages.length === 0 ? (
            <EmptyState onPromptClick={usePrompt} />
          ) : (
            <section className="message-list" aria-live="polite">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              {isSending && <LoadingMessage step={loadingStep} />}
            </section>
          )}
        </main>

        <footer className="composer-shell">
          <Composer
            value={draft}
            disabled={isSending}
            onChange={setDraft}
            onSubmit={submitMessage}
          />
          <p>ROUTEGPT V1.0 - BUILT FOR DHAKA</p>
        </footer>
      </div>

      {isAccountOpen && (
        <AccountModal account={initialAccount} onClose={() => setIsAccountOpen(false)} />
      )}
    </div>
  );
}
