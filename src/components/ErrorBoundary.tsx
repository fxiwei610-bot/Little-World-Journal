import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fff9ed] flex items-center justify-center p-6">
          <div className="bg-white border border-[#f0e9dc] rounded-[20px] p-7 max-w-md w-full text-center shadow-[0_12px_34px_rgba(57,54,45,0.07)]">
            <div className="w-12 h-12 rounded-2xl bg-[#fff0e9] text-[24px] grid place-items-center mx-auto mb-4">
              🧭
            </div>
            <h2 className="font-[900] text-[20px] text-[#27334b] mb-2">
              Something went off the map
            </h2>
            <p className="text-[13px] text-[#6c7584] mb-5 break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-[#ff826e] text-white text-[13px] font-bold shadow-[0_4px_0_#efb6a9] hover:bg-[#f47561]"
            >
              Reload journal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
