import {
  Bookmark,
  Clock3,
  Loader2,
  Plus,
  SendHorizontal,
  Settings,
  UserCircle,
  X
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const examplePrompts = [
  "Gabtoli to Mirpur 1",
  "Bashundhara theke Jatrabari bus",
  "Gulshan to Dhanmondi CNG"
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

function createAssistantMessage(content, cards = []) {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    cards
  };
}

async function sendChatMessage(message) {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message })
  });

  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || "RouteGPT could not answer this route yet.");
  }

  return body;
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

function ChatMessage({ message }) {
  return (
    <article className={`message message-${message.role}`}>
      <div className="message-bubble">
        <p>{message.content}</p>
      </div>
    </article>
  );
}

function Composer({ value, disabled, onChange, onSubmit }) {
  return (
    <form className="composer" onSubmit={onSubmit}>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder="Ask a route..."
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

export default function App() {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, isSending]);

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
        createAssistantMessage(
          `${error.message} Check that the backend is running at ${API_BASE_URL}.`
        )
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
              {isSending && (
                <article className="message message-assistant">
                  <div className="message-bubble typing">
                    <Loader2 className="spin" size={18} />
                    <span>Finding route options...</span>
                  </div>
                </article>
              )}
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
