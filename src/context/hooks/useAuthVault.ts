import { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  initDb,
  hasMasterPassword,
  saveMasterPassword,
  getVerificationToken,
  savePinVault,
  getPinData,
  resetEntireVault,
} from '../../lib/db';
import {
  createVerificationToken,
  verifyPassword,
  encrypt,
  decrypt,
} from '../../lib/crypto';
import type { ToastType, WalletView } from '../../lib/types';

export type Screen = 'loading' | 'setup' | 'unlock' | 'app' | 'error';

interface UseAuthVaultProps {
  toast: (text: string, type?: ToastType) => void;
  loadWallets: () => Promise<any>;
  wallets: WalletView[];
}

export function useAuthVault({ toast, loadWallets, wallets }: UseAuthVaultProps) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [sessionToken, setSessionToken] = useState<string>('');
  const [hasPin, setHasPin] = useState(false);
  const [initError, setInitError] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('plurivex_autolock');
    return saved ? Math.max(1, parseInt(saved, 10)) : 15;
  });

  const lastActivityRef = useRef<number>(Date.now());

  // 1. Initialize SQLite Database & Check Vault status
  const checkVaultStatus = useCallback(async () => {
    try {
      await initDb();
      const hasPw = await hasMasterPassword();
      const pinData = await getPinData();
      setHasPin(Boolean(pinData));
      setScreen(hasPw ? 'unlock' : 'setup');
    } catch (err: any) {
      console.error('Database initialization failed:', err);
      setInitError(err?.message || String(err));
      setScreen('error');
    }
  }, []);

  useEffect(() => {
    checkVaultStatus();
  }, [checkVaultStatus]);

  // 2. Auto-Lock Timer & Inactivity Listener
  const lock = useCallback(() => {
    setSessionToken('');
    setScreen('unlock');
    invoke('vault_session_lock').catch(() => {});
    invoke('clear_recovery_session', { sessionId: '' }).catch(() => {});
    toast('Vault dikunci demi keamanan', 'info');
  }, [toast]);

  useEffect(() => {
    localStorage.setItem('plurivex_autolock', String(autoLockMinutes));
  }, [autoLockMinutes]);

  useEffect(() => {
    if (screen !== 'app' || autoLockMinutes <= 0) return;

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('mousedown', handleActivity);
    window.addEventListener('touchstart', handleActivity);

    const interval = setInterval(() => {
      const elapsedMinutes = (Date.now() - lastActivityRef.current) / 60000;
      if (elapsedMinutes >= autoLockMinutes) {
        lock();
      }
    }, 15000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, [screen, autoLockMinutes, lock]);

  // 3. Password & PIN Setup Handlers
  const setupPassword = async (pw: string, pin?: string) => {
    const token = await createVerificationToken(pw);
    await saveMasterPassword(token);

    if (pin && pin.trim().length >= 4) {
      const pinToken = await createVerificationToken(pin);
      const encryptedMasterPw = await encrypt(pw, pin);
      await savePinVault(pinToken, encryptedMasterPw);
      setHasPin(true);
    }

    const sToken = await invoke<string>('vault_session_unlock', {
      password: pw,
      timeoutSeconds: autoLockMinutes * 60,
    });
    setSessionToken(sToken);
    await loadWallets();
    setScreen('app');
    toast('Brankas berhasil dibuat & terenkripsi!', 'success');
  };

  // 4. Unlock with Master Password
  const unlock = async (pw: string): Promise<boolean> => {
    const token = await getVerificationToken();
    if (!token) return false;
    const ok = await verifyPassword(token, pw);
    if (ok) {
      try {
        const sToken = await invoke<string>('vault_session_unlock', {
          password: pw,
          timeoutSeconds: autoLockMinutes * 60,
        });
        setSessionToken(sToken);
        await loadWallets();
        setScreen('app');
        toast('Brankas berhasil dibuka!', 'success');
        return true;
      } catch (err) {
        console.error('Session unlock failed:', err);
        toast('Gagal membuka sesi vault di sistem', 'error');
        return false;
      }
    }
    toast('Kata sandi master salah', 'error');
    return false;
  };

  // 5. Unlock with Quick PIN
  const unlockWithPin = async (pin: string): Promise<boolean> => {
    const pinData = await getPinData();
    if (!pinData) {
      // Fallback: check if the master password matches the PIN directly
      return await unlock(pin);
    }

    const ok = await verifyPassword(pinData.pinToken, pin);
    if (ok) {
      try {
        let decryptedMasterPw = await decrypt(pinData.pinVault, pin);
        if (decryptedMasterPw) {
          const sToken = await invoke<string>('vault_session_unlock', {
            password: decryptedMasterPw,
            timeoutSeconds: autoLockMinutes * 60,
          });
          decryptedMasterPw = ''; // Clean temporary JS variable immediately
          setSessionToken(sToken);
          await loadWallets();
          setScreen('app');
          toast('Brankas berhasil dibuka via PIN!', 'success');
          return true;
        }
      } catch (err) {
        console.error('PIN vault decryption error:', err);
      }
    }
    toast('PIN yang dimasukkan salah', 'error');
    return false;
  };

  // 6. Reset Entire Vault (Forgot Password Flow)
  const resetVault = async () => {
    await resetEntireVault();
    await invoke('vault_session_lock').catch(() => {});
    setSessionToken('');
    setHasPin(false);
    await loadWallets();
    setScreen('setup');
    toast('Vault telah di-reset. Silakan buat kata sandi baru.', 'info');
  };

  // 7. Scoped Secret Reveal (Only on Explicit User Request)
  const revealSecret = async (id: number): Promise<string | null> => {
    const w = wallets.find((x) => x.id === id);
    if (!w || !sessionToken) return null;
    try {
      return await invoke<string>('vault_reveal_secret_scoped', {
        walletId: id,
        sessionToken,
      });
    } catch (err) {
      console.error('Reveal secret error:', err);
      toast('Gagal mendekripsi secret dengan kata sandi', 'error');
      return null;
    }
  };

  return {
    screen,
    setScreen,
    sessionToken,
    setSessionToken,
    hasPin,
    initError,
    setInitError,
    autoLockMinutes,
    setAutoLockMinutes,
    lock,
    unlock,
    unlockWithPin,
    setupPassword,
    resetVault,
    revealSecret,
  };
}
