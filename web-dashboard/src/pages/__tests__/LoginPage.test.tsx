import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../LoginPage';

const signInWithPassword = vi.fn(async () => {});
const sendMagicLink = vi.fn(async () => {});
const completeEmailLinkLogin = vi.fn(async () => {});

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signInWithPassword,
    sendMagicLink,
    completeEmailLinkLogin,
  }),
}));

describe('LoginPage', () => {
  beforeEach(() => {
    signInWithPassword.mockClear();
    sendMagicLink.mockClear();
    completeEmailLinkLogin.mockClear();
  });

  it('calls signInWithPassword when form submitted', async () => {
    const view = render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    const passwordInput = screen.getByLabelText('비밀번호') as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: '이메일/비밀번호 로그인' });

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await expect(signInWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');

    view.unmount();
  });

  it('calls sendMagicLink when button clicked', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const emailInput = screen.getByLabelText('이메일') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'magic@example.com' } });

    const magicButton = screen.getByRole('button', { name: 'Magic Link 전송' });
    fireEvent.click(magicButton);

    await expect(sendMagicLink).toHaveBeenCalledWith('magic@example.com');
  });
});
