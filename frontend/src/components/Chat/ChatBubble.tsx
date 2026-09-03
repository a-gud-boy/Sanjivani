import { Volume2 } from 'lucide-react'
import type { ChatMessage } from '../../types'

interface ChatBubbleProps {
  message: ChatMessage
}

const TIME_FMT = new Intl.DateTimeFormat('en-IN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export default function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user'

  const handlePlayAudio = () => {
    // Stub: In production, call Text-to-Speech API and play the returned audio.
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(message.content)
      utterance.lang = 'en-IN'
      utterance.rate = 0.95
      window.speechSynthesis.speak(utterance)
    }
  }

  return (
    <div
      className={`flex items-end gap-2 animate-slide-up ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
          ${isUser
            ? 'bg-brand-cyan text-white'
            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200'
          }`}
        aria-hidden="true"
      >
        {isUser ? 'P' : 'AI'}
      </div>

      {/* Bubble */}
      <div className={`group max-w-[78%] sm:max-w-[70%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-card transition-colors
            ${isUser
              ? 'bg-brand-cyan text-white rounded-br-sm'
              : 'bg-white dark:bg-slate-850 dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-surface-border dark:border-slate-800 rounded-bl-sm'
            }
            ${message.hasRedFlag ? 'border-2 border-brand-crimson' : ''}
          `}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Timestamp + Audio button */}
        <div className={`flex items-center gap-2 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          <time
            className="text-[10px] text-slate-400 dark:text-slate-500"
            dateTime={message.timestamp.toISOString()}
          >
            {TIME_FMT.format(message.timestamp)}
          </time>

          {/* TTS Playback stub — only on assistant messages */}
          {!isUser && (
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity
                         p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-400 hover:text-brand-cyan dark:hover:text-brand-cyan"
              onClick={handlePlayAudio}
              aria-label="Play message audio"
              title="Listen to this message"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
