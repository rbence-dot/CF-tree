import { render, screen } from '@testing-library/react';
import App from './App.jsx';

test('renders Action Plan nav link', () => {
  render(<App />);
  expect(screen.getByText(/Action Plan/i)).toBeInTheDocument();
});
