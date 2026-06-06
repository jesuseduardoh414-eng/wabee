import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    // Chunk obsoleto tras nuevo deploy — recarga automática
    if (error.message?.includes('Failed to fetch dynamically imported module') ||
        error.message?.includes('Importing a module script failed')) {
        window.location.reload();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#121208] flex items-center justify-center p-10 text-center">
          <div className="space-y-6 max-w-md">
            <h1 className="text-white text-3xl font-black italic uppercase tracking-tighter">
              Ups, algo <span className="text-[#ead018]">salió mal</span>
            </h1>
            <p className="text-[#a0a080] text-sm">
              La plataforma encontró un error inesperado al cargar los estilos o componentes. 
              Por favor, intenta recargar la página.
            </p>
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] font-mono break-all text-left">
              {this.state.error?.message}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-[#ead018] text-[#121208] rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all"
            >
              Recargar Versión
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
