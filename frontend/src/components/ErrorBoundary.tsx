import { Component, type ReactNode } from 'react'
import { ErrorState } from './States'
import './components.css'

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? <ErrorState onRetry={() => location.reload()} /> : this.props.children
  }
}
