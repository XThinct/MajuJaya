import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
class ErrorBoundary extends Component {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? <div className="standalone-state"><h1>Something went wrong.</h1><p>Please refresh the page to try again.</p><button onClick={() => location.reload()}>Refresh</button></div> : this.props.children; }
}
createRoot(document.getElementById('root')).render(<React.StrictMode><ErrorBoundary><App/></ErrorBoundary></React.StrictMode>);
