import { useState } from "react";

interface Props {
  label: string;
}

export default function ChatbotWidget({ label }: Props) {
  const [hasOpened, setHasOpened] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-24 md:bottom-4 right-4 z-50">
      {/* Toggle Button */}
      {!isOpen && (
        <div className="relative group flex items-center justify-end">
          {/* Tooltip */}
          <div className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900/90 text-white text-sm font-medium rounded-lg shadow-lg whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {label}
            {/* Arrow */}
            <div className="absolute top-1/2 -right-1 -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-gray-900/90 border-r-0" />
          </div>

          <button
            onClick={handleOpen}
            className="bg-darkviolet hover:bg-maxpurple text-white rounded-full p-4 shadow-2xl border-2 border-white transition-all duration-300 flex items-center justify-center transform hover:scale-105"
            aria-label={label}
            title={label}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-8 h-8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Chat Window */}
      {hasOpened && (
        <div
          className={`bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 border border-gray-200 w-[calc(100vw-2rem)] sm:w-[420px] lg:w-[480px] xl:w-[540px] h-[calc(100vh-6rem)] sm:h-[600px] lg:h-[680px] max-h-[85vh] ${
            isOpen
              ? "opacity-100 scale-100 pointer-events-auto"
              : "opacity-0 scale-95 pointer-events-none absolute bottom-0 right-0 invisible"
          }`}
        >
          {/* Header */}
          <div className="bg-darkviolet text-white p-4 flex justify-between items-center shadow-md z-10">
            <h3 className="font-semibold text-lg">
              {label}
            </h3>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition-colors p-1"
              aria-label="Close Chatbot"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Iframe Container */}
          <div className="flex-1 w-full bg-gray-50 relative">
            {/* Embedded Streamlit App */}
            {/* We use ?embed=true and hide loading screen to make it feel integrated */}
            <iframe
              src="https://cwtsadbot-v2.streamlit.app/?embed=true&embed_options=light_theme&embed_options=hide_loading_screen"
              className="absolute inset-0 w-full h-full border-none"
              title="CWTS Admission Chatbot"
              loading="lazy"
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
}
